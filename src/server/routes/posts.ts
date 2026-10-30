import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client';
import prisma from '../db';
import { feedInclude, loadFeedPost, toFeedPosts } from '../feed';
import { requireAuth, requireSubscription } from '../middleware/auth';
import {
  noticeBacking,
  noticeGroupJoin,
  noticeNewPost,
  noticeSettled,
} from '../notices';
import {
  americanToDecimal,
  betPrice,
  decimalToAmerican,
  parlayDecimal,
} from '../../shared/odds';
import {
  addRungSchema,
  betBoostSchema,
  BetResult,
  betUnitsSchema,
  canAddRung,
  canBeFaded,
  canEditSlip,
  createPostSchema,
  CreatePostInput,
  DELETE_GRACE_MINUTES,
  deleteRule,
  editPostSchema,
  GROUP_MAX_LEGS,
  groupLockAtSchema,
  groupPriceSchema,
  groupResult,
  isBoostable,
  isGroupLocked,
  joinGroupSchema,
  legMarketName,
  legMarketSlot,
  lockAtError,
  LADDER_MAX_RUNGS,
  LegInput,
  FeedFilter,
  isFeedFilter,
} from '../../shared/posts';
import { betResultFromLegs } from '../../shared/grading';
import { postSeriesSchema } from '../../shared/series';
import { isStatRange, rangeStart } from '../../shared/stats';
import { MAX_GAME_MS } from '../../shared/live';
import {
  fromSiteInput,
  monthStart,
  shiftMonth,
  siteDayKey,
} from '../../shared/time';

const router = Router();
const PAGE_SIZE = 20;

/** Odds API event ids we've stored; legs pointing anywhere else drop the link */
type KnownEvents = Set<string>;

function legData(leg: LegInput, order: number, events: KnownEvents) {
  return {
    order,
    sportKey: leg.sportKey,
    eventId: leg.eventId && events.has(leg.eventId) ? leg.eventId : null,
    eventLabel: leg.eventLabel,
    marketKey: leg.marketKey,
    marketLabel: leg.marketKey === 'player_prop' ? leg.marketLabel : null,
    playerName: leg.marketKey === 'player_prop' ? leg.playerName : null,
    selection: leg.selection,
    line: leg.marketKey === 'h2h' ? null : (leg.line ?? null),
    americanOdds: leg.americanOdds,
    bookSelectionId: leg.bookSelectionId ?? null,
    deepLink: leg.deepLink ?? null,
  };
}

/**
 * Turns validated input into Bet rows (one for straight/parlay/group, one per
 * ladder rung). `authorId` owns a group parlay's first leg.
 */
function betsData(
  input: CreatePostInput,
  events: KnownEvents,
  authorId: string
) {
  switch (input.type) {
    case 'GROUP_PARLAY':
      // Priced like a parlay as legs arrive (see repriceGroup); units are
      // nominal since everyone places it with their own stake
      return [
        {
          order: 0,
          units: 1,
          americanOdds: input.leg.americanOdds,
          decimalOdds: americanToDecimal(input.leg.americanOdds),
          legs: {
            create: [{ ...legData(input.leg, 0, events), addedById: authorId }],
          },
        },
      ];
    case 'STRAIGHT':
      return [
        {
          order: 0,
          units: input.units,
          ...betPrice(
            {
              americanOdds: input.leg.americanOdds,
              decimalOdds: americanToDecimal(input.leg.americanOdds),
            },
            input.boostPct
          ),
          deepLink: input.leg.deepLink ?? null,
          legs: { create: [legData(input.leg, 0, events)] },
        },
      ];
    case 'PARLAY': {
      const decimal = input.slipOdds
        ? americanToDecimal(input.slipOdds)
        : parlayDecimal(input.legs.map((l) => l.americanOdds));
      return [
        {
          order: 0,
          units: input.units,
          ...betPrice(
            {
              americanOdds: input.slipOdds ?? decimalToAmerican(decimal),
              decimalOdds: decimal,
            },
            input.boostPct
          ),
          legs: { create: input.legs.map((l, i) => legData(l, i, events)) },
        },
      ];
    }
    case 'LADDER':
      return input.rungs.map((rung, i) => ({
        order: i,
        units: rung.units,
        americanOdds: rung.americanOdds,
        decimalOdds: americanToDecimal(rung.americanOdds),
        deepLink: rung.deepLink ?? null,
        legs: {
          create: [legData({ ...input.pick, ...rung }, 0, events)],
        },
      }));
    default:
      throw new Error('Unknown post type');
  }
}

/** The picks a post is made of (a ladder's rungs share one pick) */
function picksOf(input: CreatePostInput) {
  if (input.type === 'STRAIGHT' || input.type === 'GROUP_PARLAY')
    return [input.leg];
  if (input.type === 'PARLAY') return input.legs;
  return [input.pick];
}

const eventIdsOf = (picks: { eventId?: string }[]) =>
  picks.map((p) => p.eventId).filter((id): id is string => Boolean(id));

/** Every sport key is a known, active league */
async function sportsAreActive(picks: { sportKey: string }[]) {
  const keys = [...new Set(picks.map((p) => p.sportKey))];
  const count = await prisma.sport.count({
    where: { key: { in: keys }, active: true },
  });
  return count === keys.length;
}

/** Which of these Odds API events we have stored */
async function knownEvents(ids: string[]): Promise<KnownEvents> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Set();
  const rows = await prisma.event.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return new Set(rows.map((e) => e.id));
}

const ownsSeries = async (ownerId: string, seriesId: string) =>
  (await prisma.series.count({ where: { id: seriesId, ownerId } })) > 0;

/**
 * Settled ladders that finished up (sign 1) or down (-1) on net units, the
 * same net as profiles: a win pays units * (decimal - 1), a loss costs the
 * units, pushes and voids are 0. At exactly even (0-unit ladders, mostly)
 * the rungs decide: more hits is Won, more misses is Lost, a tie is neither.
 */
async function settledLadderIds(sign: 1 | -1): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "Post" p
    JOIN "Bet" b ON b."postId" = p."id"
    WHERE p."type" = 'LADDER' AND p."deletedAt" IS NULL
    GROUP BY p."id"
    HAVING bool_and(b."result" <> 'PENDING')
      AND COALESCE(
        NULLIF(SIGN(SUM(CASE
          WHEN b."result" = 'WON' THEN b."units" * (b."decimalOdds" - 1)
          WHEN b."result" = 'LOST' THEN -b."units"
          ELSE 0
        END)), 0),
        SIGN(SUM(CASE
          WHEN b."result" = 'WON' THEN 1
          WHEN b."result" = 'LOST' THEN -1
          ELSE 0
        END))
      ) = ${sign}
  `;
  return rows.map((r) => r.id);
}

/** Which posts a feed filter keeps (FEED_FILTERS) */
async function statusWhere(
  status: FeedFilter,
  now: Date
): Promise<Prisma.PostWhereInput> {
  switch (status) {
    case 'open':
      return { bets: { some: { result: 'PENDING' } } };
    case 'live':
      // Same rule as the LIVE tags (started, not final, within a game's
      // length), on a bet that's still alive: a parlay is lost the moment a
      // leg misses, though its other games play on, so it isn't "live"
      return {
        bets: {
          some: {
            result: 'PENDING',
            legs: {
              none: { result: 'LOST' },
              some: {
                event: {
                  completed: false,
                  commenceTime: {
                    lte: now,
                    gte: new Date(now.getTime() - MAX_GAME_MS),
                  },
                },
              },
            },
          },
        },
      };
    // Straights, parlays and group parlays are one bet: its result decides.
    // Ladders go by their final net units.
    case 'won':
      return {
        OR: [
          {
            type: { not: 'LADDER' },
            bets: { some: { result: 'WON' } },
          },
          { id: { in: await settledLadderIds(1) } },
        ],
      };
    case 'lost':
      return {
        OR: [
          {
            type: { not: 'LADDER' },
            bets: { some: { result: 'LOST' } },
          },
          { id: { in: await settledLadderIds(-1) } },
        ],
      };
    default:
      return {};
  }
}

/** Prisma unique-constraint violation */
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * Feed: everyone's posts, newest first. `?cursor=<last post id>` for the next
 * page, `?author=<username>` for one user's slips, `?series=<id>` for one
 * series, `?range=7d|30d|all`, `?status=open|live|won|lost|all` (see
 * FEED_FILTERS; default all), `?type=group` for group parlays only,
 * `?month=YYYY-MM` for one Central month (instead of a range), `?limit=` for
 * a smaller page (at most PAGE_SIZE).
 */
router.get('/', requireAuth, async (req, res) => {
  const { cursor, author, range, series, status, type, month } = req.query;
  const asked = Number(req.query.limit);
  const size =
    Number.isInteger(asked) && asked > 0
      ? Math.min(asked, PAGE_SIZE)
      : PAGE_SIZE;
  const from = typeof month === 'string' ? monthStart(month) : null;
  const until = from && monthStart(shiftMonth(month as string, 1));
  const since = isStatRange(range) ? rangeStart(range) : null;
  const now = new Date();
  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      ...(typeof author === 'string' && {
        author: { username: { equals: author, mode: 'insensitive' } },
      }),
      ...(since && { createdAt: { gte: since } }),
      ...(from && until && { createdAt: { gte: from, lt: until } }),
      ...(typeof series === 'string' && { seriesId: series }),
      ...(type === 'group' && { type: 'GROUP_PARLAY' as const }),
      ...(isFeedFilter(status) ? await statusWhere(status, now) : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: size + 1,
    ...(typeof cursor === 'string' && { cursor: { id: cursor }, skip: 1 }),
    include: feedInclude,
  });
  const hasMore = posts.length > size;
  const page = posts.slice(0, size);
  res.json({
    posts: await toFeedPosts(page, req.user!.id),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

/** Most posts one refresh call returns */
const REFRESH_MAX = 30;

/**
 * Fresh copies of posts the viewer already has, so cards with games on pick
 * up mid-game grades without a reload. `?ids=a,b,c`; deleted ones are left out.
 */
router.get('/refresh', requireAuth, async (req, res) => {
  const ids =
    typeof req.query.ids === 'string'
      ? req.query.ids.split(',').filter(Boolean).slice(0, REFRESH_MAX)
      : [];
  if (!ids.length) {
    res.json([]);
    return;
  }
  const posts = await prisma.post.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: feedInclude,
  });
  res.json(await toFeedPosts(posts, req.user!.id));
});

/**
 * What's in play right now, for the feed's side panels: group parlays not
 * yet settled (taking legs, locked, or live), and personal slips with a game
 * on. Database only, no Odds API calls.
 */
router.get('/active', requireAuth, async (req, res) => {
  const now = new Date();
  // Midnight Central, so a group parlay settled today stays up with its result
  const today = fromSiteInput(`${siteDayKey(now)}T00:00`) ?? now;
  // A game that started within the longest possible game length and isn't
  // marked final yet (same rule as the LIVE tags). Settled slips count too,
  // so a parlay that busted mid-game shows it while the game is on.
  const liveLeg = {
    event: {
      completed: false,
      commenceTime: {
        lte: now,
        gte: new Date(now.getTime() - MAX_GAME_MS),
      },
    },
  };
  const [groups, live] = await Promise.all([
    prisma.post.findMany({
      where: {
        type: 'GROUP_PARLAY',
        deletedAt: null,
        bets: {
          some: {
            OR: [{ result: 'PENDING' }, { settledAt: { gte: today } }],
          },
        },
      },
      orderBy: [{ lockAt: 'asc' }, { id: 'asc' }],
      take: 10,
      include: feedInclude,
    }),
    prisma.post.findMany({
      where: {
        type: { not: 'GROUP_PARLAY' },
        deletedAt: null,
        bets: { some: { legs: { some: liveLeg } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 15,
      include: feedInclude,
    }),
  ]);
  res.json({
    groups: await toFeedPosts(groups, req.user!.id),
    live: await toFeedPosts(live, req.user!.id),
  });
});

router.post('/', requireAuth, requireSubscription, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? 'Invalid post' });
    return;
  }
  const input = parsed.data;

  const sportsbook = await prisma.sportsbook.findUnique({
    where: { key: input.sportsbookKey },
  });
  if (!sportsbook?.active) {
    res.status(400).json({ error: 'Unknown sportsbook' });
    return;
  }
  const picks = picksOf(input);
  if (!(await sportsAreActive(picks))) {
    res.status(400).json({ error: 'Unknown sport' });
    return;
  }

  let lockAt: Date | null = null;
  // One-game group parlays pin the creator's game; legs are checked on join
  let groupGame: { groupEventId: string; groupEventLabel: string } | null =
    null;
  if (input.type === 'GROUP_PARLAY') {
    if (input.gameOnly) {
      if (!input.leg.eventId) {
        res
          .status(400)
          .json({ error: 'Pick your leg from live odds to keep it to a game' });
        return;
      }
      groupGame = {
        groupEventId: input.leg.eventId,
        groupEventLabel: input.leg.eventLabel,
      };
    }
    lockAt = new Date(input.lockAt);
    const deadlineError = lockAtError(lockAt);
    if (deadlineError) {
      res.status(400).json({ error: deadlineError });
      return;
    }
  }

  // A series has to be one of the poster's own
  const seriesId = input.type === 'GROUP_PARLAY' ? undefined : input.seriesId;
  if (seriesId && !(await ownsSeries(req.user!.id, seriesId))) {
    res.status(400).json({ error: 'Unknown series' });
    return;
  }

  const events = await knownEvents(eventIdsOf(picks));
  const post = await prisma.post.create({
    data: {
      authorId: req.user!.id,
      type: input.type,
      caption: input.caption || null,
      sportsbookId: sportsbook.id,
      lockAt,
      ...groupGame,
      seriesId: seriesId ?? null,
      bets: { create: betsData(input, events, req.user!.id) },
    },
    include: feedInclude,
  });
  res.status(201).json((await toFeedPosts([post], req.user!.id))[0]);
  noticeNewPost(post.id);
});

/** Author marks a bet (or ladder rung) won/lost/push/void, or back to pending */
router.patch<{ betId: string }>(
  '/bets/:betId',
  requireAuth,
  async (req, res) => {
    const parsed = z
      .object({ result: z.enum(['PENDING', 'WON', 'LOST', 'PUSH', 'VOID']) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid result' });
      return;
    }
    const bet = await prisma.bet.findUnique({
      where: { id: req.params.betId },
      include: {
        post: { select: { authorId: true, deletedAt: true, type: true } },
      },
    });
    if (!bet || bet.post.deletedAt) {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    if (bet.post.type === 'GROUP_PARLAY') {
      res
        .status(400)
        .json({ error: 'Settle a group parlay one leg at a time' });
      return;
    }
    if (bet.post.authorId !== req.user!.id && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the poster can settle this bet' });
      return;
    }
    const { result } = parsed.data;
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        result,
        settledAt: result === 'PENDING' ? null : new Date(),
        // A hand-set result is never overwritten by the auto-grader
        gradedBy: result === 'PENDING' ? null : 'MANUAL',
      },
    });
    // The whole slip comes back since the poster's streak may have moved
    res.json(await loadFeedPost(bet.postId, req.user!.id));
    if (bet.result === 'PENDING' && result !== 'PENDING') {
      noticeSettled([bet.postId], req.user!.id);
    }
  }
);

/**
 * A live slip the viewer can tail / fade: not settled, and for group parlays
 * locked. Sends the error and returns null otherwise. Tailing your own slip
 * isn't allowed (placing your own group parlay is); fading never is, and
 * group parlays can't be faded.
 */
async function backable(
  req: Request<{ postId: string }>,
  res: Response,
  kind: 'tail' | 'fade'
) {
  const viewerId = req.user!.id;
  const post = await prisma.post.findFirst({
    where: { id: req.params.postId, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      type: true,
      lockAt: true,
      lockedAt: true,
      bets: {
        select: {
          id: true,
          result: true,
          legs: { select: { marketKey: true, selection: true } },
        },
      },
    },
  });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return null;
  }
  // Settled slips keep their tails and fades on the record
  if (!post.bets.some((b) => b.result === 'PENDING')) {
    res.status(400).json({ error: 'This slip is already settled' });
    return null;
  }
  if (post.type === 'GROUP_PARLAY') {
    if (kind === 'fade') {
      res.status(400).json({ error: "Group parlays can't be faded" });
      return null;
    }
    if (!isGroupLocked({ lockAt: post.lockAt!, lockedAt: post.lockedAt })) {
      res.status(400).json({ error: 'This group parlay is still taking legs' });
      return null;
    }
  } else if (post.authorId === viewerId) {
    res.status(400).json({ error: `You can't ${kind} your own slip` });
    return null;
  }
  return post;
}

/**
 * Tail a slip: records a tail on every bet in the post (each ladder rung is its
 * own bet) and drops the viewer's fade, since you can't do both. Free users
 * can tail. Repeat tails are no-ops, so "Bet again" never double counts.
 */
router.post<{ postId: string }>(
  '/:postId/tail',
  requireAuth,
  async (req, res) => {
    const viewerId = req.user!.id;
    const post = await backable(req, res, 'tail');
    if (!post) return;
    const alreadyTailed = await prisma.tail.count({
      where: { userId: viewerId, bet: { postId: post.id } },
    });
    await prisma.$transaction([
      prisma.fade.deleteMany({ where: { postId: post.id, userId: viewerId } }),
      prisma.tail.createMany({
        data: post.bets.map((b) => ({ userId: viewerId, betId: b.id })),
        skipDuplicates: true,
      }),
    ]);
    res.json(await loadFeedPost(post.id, viewerId));
    // Once per person; placing a group parlay everyone's in isn't news
    if (!alreadyTailed && post.type !== 'GROUP_PARLAY') {
      noticeBacking(post.id, viewerId, 'tail');
    }
  }
);

/** Untail, while the slip is still open */
router.delete<{ postId: string }>(
  '/:postId/tail',
  requireAuth,
  async (req, res) => {
    const viewerId = req.user!.id;
    const post = await backable(req, res, 'tail');
    if (!post) return;
    await prisma.tail.deleteMany({
      where: { userId: viewerId, bet: { postId: post.id } },
    });
    res.json(await loadFeedPost(post.id, viewerId));
  }
);

/** Fade a slip (bet against it); drops the viewer's tail */
router.post<{ postId: string }>(
  '/:postId/fade',
  requireAuth,
  async (req, res) => {
    const viewerId = req.user!.id;
    const post = await backable(req, res, 'fade');
    if (!post) return;
    // Checked here, not in backable, so older fades can still be undone
    if (
      !canBeFaded(
        post.type,
        post.bets.flatMap((b) => b.legs)
      )
    ) {
      res
        .status(400)
        .json({ error: 'Only straight bets with two sides can be faded' });
      return;
    }
    const [, { count: faded }] = await prisma.$transaction([
      prisma.tail.deleteMany({
        where: { userId: viewerId, bet: { postId: post.id } },
      }),
      prisma.fade.createMany({
        data: [{ userId: viewerId, postId: post.id }],
        skipDuplicates: true,
      }),
    ]);
    res.json(await loadFeedPost(post.id, viewerId));
    if (faded) noticeBacking(post.id, viewerId, 'fade');
  }
);

/** Unfade, while the slip is still open */
router.delete<{ postId: string }>(
  '/:postId/fade',
  requireAuth,
  async (req, res) => {
    const viewerId = req.user!.id;
    const post = await backable(req, res, 'fade');
    if (!post) return;
    await prisma.fade.deleteMany({
      where: { userId: viewerId, postId: post.id },
    });
    res.json(await loadFeedPost(post.id, viewerId));
  }
);

// ---------- Group parlays ----------

type Tx = Prisma.TransactionClient;

/** A live group parlay and its single bet, or null */
const findGroup = (postId: string, db: Tx | typeof prisma = prisma) =>
  db.post.findFirst({
    where: { id: postId, deletedAt: null, type: 'GROUP_PARLAY' },
    select: {
      id: true,
      authorId: true,
      sportsbookId: true,
      lockAt: true,
      lockedAt: true,
      groupEventId: true,
      groupEventLabel: true,
      bets: {
        select: {
          id: true,
          legs: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              addedById: true,
              americanOdds: true,
              result: true,
            },
          },
        },
      },
    },
  });

const groupIsLocked = (group: { lockAt: Date | null; lockedAt: Date | null }) =>
  isGroupLocked({ lockAt: group.lockAt!, lockedAt: group.lockedAt });

/** Re-price the group bet as the product of its legs */
async function repriceGroup(tx: Tx, betId: string) {
  const legs = await tx.betLeg.findMany({
    where: { betId },
    select: { americanOdds: true },
  });
  const decimal = parlayDecimal(legs.map((l) => l.americanOdds));
  await tx.bet.update({
    where: { id: betId },
    data: { decimalOdds: decimal, americanOdds: decimalToAmerican(decimal) },
  });
}

/** Someone else's leg is already on that market */
class LegTakenError extends Error {}

/** Add your one leg to an open group parlay */
router.post<{ postId: string }>(
  '/:postId/legs',
  requireAuth,
  requireSubscription,
  async (req, res) => {
    const parsed = joinGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid leg' });
      return;
    }
    const { leg } = parsed.data;
    const userId = req.user!.id;
    const group = await findGroup(req.params.postId);
    if (!group) {
      res.status(404).json({ error: 'Group parlay not found' });
      return;
    }
    if (groupIsLocked(group)) {
      res.status(400).json({ error: 'This group parlay is locked' });
      return;
    }
    const bet = group.bets[0];
    if (bet.legs.some((l) => l.addedById === userId)) {
      res.status(409).json({ error: 'You already have a leg in this one' });
      return;
    }
    if (bet.legs.length >= GROUP_MAX_LEGS) {
      res.status(400).json({ error: `It's full at ${GROUP_MAX_LEGS} legs` });
      return;
    }
    if (group.groupEventId && leg.eventId !== group.groupEventId) {
      res
        .status(400)
        .json({ error: `This one is a ${group.groupEventLabel} SGP` });
      return;
    }
    if (!(await sportsAreActive([leg]))) {
      res.status(400).json({ error: 'Unknown sport' });
      return;
    }

    const events = await knownEvents(eventIdsOf([leg]));
    try {
      await prisma.$transaction(async (tx) => {
        // One leg per market: no repeats, other sides or other lines (FanDuel
        // won't parlay them). Read in here so a join a moment ago counts.
        const slot = legMarketSlot(leg);
        const clash = (
          await tx.betLeg.findMany({
            where: { betId: bet.id },
            select: {
              eventId: true,
              eventLabel: true,
              marketKey: true,
              marketLabel: true,
              playerName: true,
              addedBy: { select: { fullName: true } },
            },
          })
        ).find((l) => legMarketSlot(l) === slot);
        if (clash) {
          throw new LegTakenError(
            `${legMarketName(clash)} is already ${
              clash.addedBy?.fullName ?? 'someone'
            }'s leg. Pick something else.`
          );
        }
        const last = await tx.betLeg.aggregate({
          where: { betId: bet.id },
          _max: { order: true },
        });
        await tx.betLeg.create({
          data: {
            ...legData(leg, (last._max.order ?? -1) + 1, events),
            betId: bet.id,
            addedById: userId,
          },
        });
        await repriceGroup(tx, bet.id);
      });
    } catch (err) {
      if (err instanceof LegTakenError) {
        res.status(409).json({ error: err.message });
        return;
      }
      // Lost a race: same person twice, or two joins grabbed the same slot
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: 'Someone just joined. Try again.' });
        return;
      }
      throw err;
    }
    res.status(201).json(await loadFeedPost(group.id, userId));
    noticeGroupJoin(group.id, userId);
  }
);

/** Take a leg out while it's open: your own, or any leg if you started it */
router.delete<{ postId: string; legId: string }>(
  '/:postId/legs/:legId',
  requireAuth,
  async (req, res) => {
    const userId = req.user!.id;
    const group = await findGroup(req.params.postId);
    const leg = group?.bets[0].legs.find((l) => l.id === req.params.legId);
    if (!group || !leg) {
      res.status(404).json({ error: 'Leg not found' });
      return;
    }
    if (leg.addedById !== userId && group.authorId !== userId) {
      res.status(403).json({ error: 'That isn’t your leg' });
      return;
    }
    if (groupIsLocked(group)) {
      res.status(400).json({ error: 'This group parlay is locked' });
      return;
    }
    if (group.bets[0].legs.length === 1) {
      res
        .status(400)
        .json({ error: 'It needs at least one leg. Delete the slip instead.' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.betLeg.delete({ where: { id: leg.id } });
      await repriceGroup(tx, group.bets[0].id);
    });
    res.json(await loadFeedPost(group.id, userId));
  }
);

/** The creator locks it early; needs two legs to be a parlay */
router.post<{ postId: string }>(
  '/:postId/lock',
  requireAuth,
  async (req, res) => {
    const userId = req.user!.id;
    const group = await findGroup(req.params.postId);
    if (!group) {
      res.status(404).json({ error: 'Group parlay not found' });
      return;
    }
    if (group.authorId !== userId) {
      res.status(403).json({ error: 'Only the creator can lock it' });
      return;
    }
    if (groupIsLocked(group)) {
      res.status(400).json({ error: 'It’s already locked' });
      return;
    }
    if (group.bets[0].legs.length < 2) {
      res.status(400).json({ error: 'Wait for at least 2 legs' });
      return;
    }
    await prisma.post.update({
      where: { id: group.id },
      data: { lockedAt: new Date() },
    });
    res.json(await loadFeedPost(group.id, userId));
  }
);

/**
 * The creator (or an admin) moves the deadline while it's still open, under
 * the same rules as starting one. The "locks soon" reminder is re-armed so
 * it goes out ahead of the new time.
 */
router.put<{ postId: string }>(
  '/:postId/lock-at',
  requireAuth,
  async (req, res) => {
    const parsed = groupLockAtSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Set a deadline' });
      return;
    }
    const userId = req.user!.id;
    const group = await findGroup(req.params.postId);
    if (!group) {
      res.status(404).json({ error: 'Group parlay not found' });
      return;
    }
    if (group.authorId !== userId && !req.user!.isAdmin) {
      res
        .status(403)
        .json({ error: 'Only the creator can change the lock time' });
      return;
    }
    if (groupIsLocked(group)) {
      res.status(400).json({ error: 'It’s already locked' });
      return;
    }
    const lockAt = new Date(parsed.data.lockAt);
    const deadlineError = lockAtError(lockAt);
    if (deadlineError) {
      res.status(400).json({ error: deadlineError });
      return;
    }
    await prisma.post.update({
      where: { id: group.id },
      data: { lockAt, lockReminderAt: null },
    });
    res.json(await loadFeedPost(group.id, userId));
  }
);

/**
 * The creator enters the book's price once it's locked. Same-game parlays
 * price below the legs multiplied, and there's no public formula for it.
 */
router.put<{ postId: string }>(
  '/:postId/price',
  requireAuth,
  async (req, res) => {
    const parsed = groupPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid odds' });
      return;
    }
    const userId = req.user!.id;
    const group = await findGroup(req.params.postId);
    if (!group) {
      res.status(404).json({ error: 'Group parlay not found' });
      return;
    }
    if (group.authorId !== userId) {
      res.status(403).json({ error: 'Only the creator can set the price' });
      return;
    }
    if (!groupIsLocked(group)) {
      res.status(400).json({ error: 'Lock it first so the legs are final' });
      return;
    }
    const { americanOdds } = parsed.data;
    await prisma.bet.update({
      where: { id: group.bets[0].id },
      data: { americanOdds, decimalOdds: americanToDecimal(americanOdds) },
    });
    res.json(await loadFeedPost(group.id, userId));
  }
);

/**
 * The author sets a bet's overall odds to what the book actually shows (our
 * parlay math can't match same-game pricing, boosts, etc.). Any slip type,
 * any time; a straight's or ladder rung's single leg follows. On an open
 * group parlay, adding or removing a leg resets it to the legs multiplied.
 */
router.put<{ betId: string }>(
  '/bets/:betId/odds',
  requireAuth,
  async (req, res) => {
    const parsed = groupPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid odds' });
      return;
    }
    const userId = req.user!.id;
    const bet = await prisma.bet.findFirst({
      where: { id: req.params.betId, post: { deletedAt: null } },
      select: {
        id: true,
        boostPct: true,
        legs: { select: { id: true } },
        post: { select: { id: true, authorId: true, type: true } },
      },
    });
    if (!bet) {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    const { post } = bet;
    if (post.authorId !== userId && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the poster can change the odds' });
      return;
    }
    // The book's regular odds; a boost on the bet is applied on top
    const { americanOdds } = parsed.data;
    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: betPrice(
          { americanOdds, decimalOdds: americanToDecimal(americanOdds) },
          bet.boostPct
        ),
      }),
      // One-leg bets show the leg's price, so keep them in step
      ...(bet.legs.length === 1 && post.type !== 'GROUP_PARLAY'
        ? [
            prisma.betLeg.update({
              where: { id: bet.legs[0].id },
              data: { americanOdds },
            }),
          ]
        : []),
    ]);
    res.json(await loadFeedPost(post.id, userId));
  }
);

/**
 * The author sets (or with 0 removes) a straight's or parlay's profit boost,
 * any time (see isBoostable). The boosted price is stored as the bet's odds,
 * so payouts and stats count it, and it's always worked out from the
 * regular odds.
 */
router.put<{ betId: string }>(
  '/bets/:betId/boost',
  requireAuth,
  async (req, res) => {
    const parsed = betBoostSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid boost' });
      return;
    }
    const userId = req.user!.id;
    const bet = await prisma.bet.findFirst({
      where: { id: req.params.betId, post: { deletedAt: null } },
      select: {
        id: true,
        americanOdds: true,
        decimalOdds: true,
        regularOdds: true,
        post: { select: { id: true, authorId: true, type: true } },
      },
    });
    if (!bet) {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    if (!isBoostable(bet.post.type)) {
      res
        .status(400)
        .json({ error: 'Only straights and parlays can be boosted' });
      return;
    }
    if (bet.post.authorId !== userId && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the poster can boost a slip' });
      return;
    }
    // Unboosted, the stored price is the regular one (keeping a parlay's
    // exact multiplied decimal); boosted, start back from the regular odds
    const regular =
      bet.regularOdds == null
        ? {
            americanOdds: bet.americanOdds,
            decimalOdds: bet.decimalOdds.toNumber(),
          }
        : {
            americanOdds: bet.regularOdds,
            decimalOdds: americanToDecimal(bet.regularOdds),
          };
    await prisma.bet.update({
      where: { id: bet.id },
      data: betPrice(regular, parsed.data.boostPct),
    });
    res.json(await loadFeedPost(bet.post.id, userId));
  }
);

/**
 * The author changes a bet's stake (0 is allowed). Any personal slip, any
 * time, like the odds; a ladder sets each rung on its own. Group parlays
 * have no stake of their own.
 */
router.put<{ betId: string }>(
  '/bets/:betId/units',
  requireAuth,
  async (req, res) => {
    const parsed = betUnitsSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid units' });
      return;
    }
    const userId = req.user!.id;
    const bet = await prisma.bet.findFirst({
      where: { id: req.params.betId, post: { deletedAt: null } },
      select: {
        id: true,
        post: { select: { id: true, authorId: true, type: true } },
      },
    });
    if (!bet || bet.post.type === 'GROUP_PARLAY') {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    if (bet.post.authorId !== userId && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the poster can change the units' });
      return;
    }
    await prisma.bet.update({
      where: { id: bet.id },
      data: { units: parsed.data.units },
    });
    res.json(await loadFeedPost(bet.post.id, userId));
  }
);

/**
 * Add a rung to a ladder at a typed line + price (see canAddRung: the author
 * pregame, admins any time). It copies the ladder's pick, has no book link,
 * and the grader picks it up like any rung. Rungs are renumbered by line so
 * the card keeps them in order.
 */
router.post<{ postId: string }>(
  '/:postId/rungs',
  requireAuth,
  requireSubscription,
  async (req, res) => {
    const parsed = addRungSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid rung' });
      return;
    }
    const { isAdmin, id: userId } = req.user!;
    const post = await prisma.post.findFirst({
      where: { id: req.params.postId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        type: true,
        bets: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            result: true,
            legs: {
              select: {
                result: true,
                line: true,
                sportKey: true,
                eventId: true,
                eventLabel: true,
                marketKey: true,
                marketLabel: true,
                selection: true,
                playerId: true,
                playerName: true,
                event: { select: { commenceTime: true } },
              },
            },
          },
        },
      },
    });
    if (!post || post.type !== 'LADDER') {
      res.status(404).json({ error: 'Ladder not found' });
      return;
    }
    if (post.authorId !== userId && !isAdmin) {
      res.status(403).json({ error: 'Only the poster can add a rung' });
      return;
    }
    const addable = canAddRung(
      {
        type: post.type,
        bets: post.bets.map((b) => ({
          result: b.result,
          legs: b.legs.map((l) => ({
            result: l.result,
            startsAt: l.event?.commenceTime ?? null,
          })),
        })),
      },
      new Date(),
      isAdmin
    );
    if (!addable) {
      res.status(400).json({
        error:
          post.bets.length >= LADDER_MAX_RUNGS
            ? `A ladder can have at most ${LADDER_MAX_RUNGS} rungs`
            : 'Rungs can only be added before the game starts',
      });
      return;
    }
    const { line, americanOdds, units } = parsed.data;
    const lines = post.bets.map((b) => Number(b.legs[0].line));
    if (lines.includes(line)) {
      res.status(400).json({ error: 'That line is already a rung' });
      return;
    }
    const [first] = post.bets[0].legs;
    const pick = {
      sportKey: first.sportKey,
      eventId: first.eventId,
      eventLabel: first.eventLabel,
      marketKey: first.marketKey,
      marketLabel: first.marketLabel,
      selection: first.selection,
      playerId: first.playerId,
      playerName: first.playerName,
    };
    // Every rung, new one included, by line; (postId, order) is unique, so
    // park the old ones out of the way first
    const sorted = [
      ...post.bets.map((b, i) => ({ id: b.id, line: lines[i] })),
      { id: null, line },
    ].sort((a, b) => a.line - b.line);
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        post.bets.map((b, i) =>
          tx.bet.update({ where: { id: b.id }, data: { order: -1 - i } })
        )
      );
      await Promise.all(
        sorted.map((r, order) =>
          r.id
            ? tx.bet.update({ where: { id: r.id }, data: { order } })
            : tx.bet.create({
                data: {
                  postId: post.id,
                  order,
                  units,
                  americanOdds,
                  decimalOdds: americanToDecimal(americanOdds),
                  legs: { create: [{ ...pick, order: 0, line, americanOdds }] },
                },
              })
        )
      );
    });
    res.status(201).json(await loadFeedPost(post.id, userId));
  }
);

/**
 * The author (or an admin) sets one leg of a personal slip by hand. The bet
 * follows its legs, so a parlay flips with the leg; it stays open to the
 * grader, which still grades the other legs and never touches this one.
 */
/** Keeps the settle time when the result didn't change */
function settledAtFor(next: BetResult, prev: BetResult, at: Date | null) {
  if (next === 'PENDING') return null;
  return next === prev ? at : new Date();
}

async function settlePersonalLeg(
  req: Request<{ legId: string }>,
  res: Response,
  result: BetResult
) {
  const userId = req.user!.id;
  const leg = await prisma.betLeg.findUnique({
    where: { id: req.params.legId },
    include: {
      bet: {
        include: {
          legs: { select: { id: true, result: true } },
          post: { select: { id: true, authorId: true, deletedAt: true } },
        },
      },
    },
  });
  if (!leg || leg.bet.post.deletedAt) {
    res.status(404).json({ error: 'Leg not found' });
    return;
  }
  const { bet } = leg;
  if (bet.post.authorId !== userId && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Only the poster can settle this leg' });
    return;
  }
  const overall = betResultFromLegs(
    bet.legs.map((l) => (l.id === leg.id ? result : l.result))
  );
  await prisma.$transaction([
    prisma.betLeg.update({
      where: { id: leg.id },
      data: { result, gradedBy: result === 'PENDING' ? null : 'MANUAL' },
    }),
    prisma.bet.update({
      where: { id: bet.id },
      data: {
        result: overall,
        settledAt: settledAtFor(overall, bet.result, bet.settledAt),
        // Derived from the legs, so the grader keeps rolling them up
        gradedBy: overall === 'PENDING' ? null : 'AUTO',
      },
    }),
  ]);
  res.json(await loadFeedPost(bet.post.id, userId));
  if (bet.result === 'PENDING' && overall !== 'PENDING') {
    noticeSettled([bet.post.id], userId);
  }
}

/**
 * Grade one group parlay leg (its owner or the creator, once locked). The
 * parlay's result follows from its legs. Personal slips' legs go to
 * settlePersonalLeg.
 */
router.patch<{ legId: string }>(
  '/legs/:legId',
  requireAuth,
  async (req, res) => {
    const parsed = z
      .object({ result: z.enum(['PENDING', 'WON', 'LOST', 'PUSH', 'VOID']) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid result' });
      return;
    }
    const userId = req.user!.id;
    const found = await prisma.betLeg.findUnique({
      where: { id: req.params.legId },
      select: {
        bet: { select: { postId: true, post: { select: { type: true } } } },
      },
    });
    if (found && found.bet.post.type !== 'GROUP_PARLAY') {
      await settlePersonalLeg(req, res, parsed.data.result);
      return;
    }
    const group = found && (await findGroup(found.bet.postId));
    if (!group) {
      res.status(404).json({ error: 'Leg not found' });
      return;
    }
    const bet = group.bets[0];
    const leg = bet.legs.find((l) => l.id === req.params.legId)!;
    if (
      leg.addedById !== userId &&
      group.authorId !== userId &&
      !req.user!.isAdmin
    ) {
      res
        .status(403)
        .json({ error: 'Only the leg’s owner or the creator can settle it' });
      return;
    }
    if (!groupIsLocked(group)) {
      res.status(400).json({ error: 'Lock it before settling legs' });
      return;
    }
    const { result } = parsed.data;
    const results: BetResult[] = bet.legs.map((l) =>
      l.id === leg.id ? result : l.result
    );
    const overall = groupResult(results);
    await prisma.$transaction([
      prisma.betLeg.update({
        where: { id: leg.id },
        data: { result, gradedBy: result === 'PENDING' ? null : 'MANUAL' },
      }),
      prisma.bet.update({
        where: { id: bet.id },
        data: {
          result: overall,
          settledAt: overall === 'PENDING' ? null : new Date(),
        },
      }),
    ]);
    res.json(await loadFeedPost(group.id, userId));
    const before = groupResult(bet.legs.map((l) => l.result));
    if (before === 'PENDING' && overall !== 'PENDING') {
      noticeSettled([group.id], userId);
    }
  }
);

/** File one of your slips under one of your series, or take it out */
router.put<{ postId: string }>(
  '/:postId/series',
  requireAuth,
  async (req, res) => {
    const parsed = postSeriesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid series' });
      return;
    }
    const userId = req.user!.id;
    const post = await prisma.post.findFirst({
      where: { id: req.params.postId, deletedAt: null, authorId: userId },
      select: { id: true, type: true },
    });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    if (post.type === 'GROUP_PARLAY') {
      res.status(400).json({ error: 'Group parlays can’t go in a series' });
      return;
    }
    const { seriesId } = parsed.data;
    if (seriesId && !(await ownsSeries(userId, seriesId))) {
      res.status(400).json({ error: 'Unknown series' });
      return;
    }
    await prisma.post.update({ where: { id: post.id }, data: { seriesId } });
    res.json(await loadFeedPost(post.id, userId));
  }
);

/**
 * The author edits a straight or parlay before any of its games start: keep
 * some legs, add new ones from live odds (games that haven't started), change
 * the stake or set the book's price. One leg left makes it a straight, more
 * a parlay. Tails, reactions and comments stay with the slip. Admins can
 * edit anyone's, any time, graded or not.
 */
router.put<{ postId: string }>(
  '/:postId',
  requireAuth,
  requireSubscription,
  async (req, res) => {
    const parsed = editPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? 'Invalid edit' });
      return;
    }
    const input = parsed.data;
    const post = await prisma.post.findFirst({
      where: { id: req.params.postId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        type: true,
        bets: {
          select: {
            id: true,
            result: true,
            gradedBy: true,
            legs: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                result: true,
                event: { select: { commenceTime: true } },
              },
            },
          },
        },
      },
    });
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const { isAdmin } = req.user!;
    if (post.authorId !== req.user!.id && !isAdmin) {
      res.status(403).json({ error: 'Only the poster can edit a slip' });
      return;
    }
    const editable = canEditSlip(
      {
        type: post.type,
        bets: post.bets.map((b) => ({
          result: b.result,
          legs: b.legs.map((l) => ({
            result: l.result,
            startsAt: l.event?.commenceTime ?? null,
          })),
        })),
      },
      new Date(),
      isAdmin
    );
    if (!editable) {
      res.status(400).json({
        error:
          post.type === 'STRAIGHT' || post.type === 'PARLAY'
            ? 'Slips lock once one of their games starts'
            : 'Only straights and parlays can be edited',
      });
      return;
    }
    const [bet] = post.bets;
    const current = new Set(bet.legs.map((l) => l.id));
    const keep = [...new Set(input.keepLegIds)];
    if (keep.some((id) => !current.has(id))) {
      res.status(400).json({ error: 'That leg is not on this slip' });
      return;
    }

    // New legs: real leagues, stored games, and only games that haven't started
    if (input.legs.length) {
      if (!(await sportsAreActive(input.legs))) {
        res.status(400).json({ error: 'Unknown sport' });
        return;
      }
      const ids = eventIdsOf(input.legs);
      const games = await prisma.event.findMany({
        where: { id: { in: ids } },
        select: { id: true, commenceTime: true },
      });
      const starts = new Map(games.map((g) => [g.id, g.commenceTime]));
      const unknown = input.legs.some(
        (l) => !l.eventId || !starts.has(l.eventId)
      );
      if (unknown) {
        res.status(400).json({ error: 'Add new legs from live odds' });
        return;
      }
      // Admins fixing a slip can add in-game picks the poster really made
      const startedLeg =
        !isAdmin &&
        input.legs.find((l) => starts.get(l.eventId!)!.getTime() <= Date.now());
      if (startedLeg) {
        res
          .status(400)
          .json({ error: `${startedLeg.eventLabel} has already started` });
        return;
      }
    }
    const events = new Set(eventIdsOf(input.legs));

    const total = keep.length + input.legs.length;
    const type = total === 1 ? 'STRAIGHT' : 'PARLAY';
    await prisma.$transaction(async (tx) => {
      await tx.betLeg.deleteMany({
        where: { betId: bet.id, id: { notIn: keep } },
      });
      // (betId, order) is unique, so park kept legs out of the way first
      await Promise.all(
        keep.map((id, i) =>
          tx.betLeg.update({ where: { id }, data: { order: -1 - i } })
        )
      );
      await Promise.all(
        keep.map((id, i) =>
          tx.betLeg.update({ where: { id }, data: { order: i } })
        )
      );
      await tx.betLeg.createMany({
        data: input.legs.map((l, i) => ({
          ...legData(l, keep.length + i, events),
          betId: bet.id,
        })),
      });
      const legs = await tx.betLeg.findMany({
        where: { betId: bet.id },
        orderBy: { order: 'asc' },
        select: { americanOdds: true, deepLink: true, result: true },
      });
      // Adding or dropping legs (admins, on a graded slip) re-derives the
      // result from what's left; a PENDING one goes back to the grader
      const legsChanged =
        input.legs.length > 0 || keep.length !== bet.legs.length;
      const result = legsChanged
        ? betResultFromLegs(legs.map((l) => l.result))
        : bet.result;
      const grade =
        result === bet.result
          ? {}
          : {
              result,
              settledAt: result === 'PENDING' ? null : new Date(),
              gradedBy: result === 'PENDING' ? null : ('MANUAL' as const),
            };
      // A straight's price is its leg's; a parlay's is the book's or the legs
      // multiplied. The boost (kept unless the edit changes it) goes on top.
      let { americanOdds } = legs[0];
      let decimal = americanToDecimal(americanOdds);
      if (type === 'PARLAY') {
        decimal = input.slipOdds
          ? americanToDecimal(input.slipOdds)
          : parlayDecimal(legs.map((l) => l.americanOdds));
        americanOdds = input.slipOdds ?? decimalToAmerican(decimal);
      }
      const priced = await tx.bet.findUniqueOrThrow({
        where: { id: bet.id },
        select: { boostPct: true },
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: {
          ...grade,
          units: input.units,
          ...betPrice(
            { americanOdds, decimalOdds: decimal },
            input.boostPct ?? priced.boostPct
          ),
          deepLink: type === 'STRAIGHT' ? legs[0].deepLink : null,
        },
      });
      await tx.post.update({
        where: { id: post.id },
        data: {
          type,
          ...(input.caption !== undefined && {
            caption: input.caption || null,
          }),
        },
      });
    });
    res.json(await loadFeedPost(post.id, req.user!.id));
  }
);

/**
 * Delete your slip (see deleteRule): a settled slip is hidden but keeps
 * counting toward records; one posted by mistake (unsettled, within the
 * grace window) or an unlocked group parlay is removed entirely; anything
 * else has to be settled first. Admins can delete anyone's, any time.
 */
router.delete<{ postId: string }>('/:postId', requireAuth, async (req, res) => {
  const { isAdmin } = req.user!;
  const post = await prisma.post.findFirst({
    where: {
      id: req.params.postId,
      deletedAt: null,
      ...(!isAdmin && { authorId: req.user!.id }),
    },
    select: {
      id: true,
      type: true,
      createdAt: true,
      lockAt: true,
      lockedAt: true,
      bets: { select: { result: true } },
    },
  });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const rule = deleteRule(
    {
      ...post,
      group:
        post.type === 'GROUP_PARLAY' && post.lockAt
          ? { lockAt: post.lockAt, lockedAt: post.lockedAt }
          : null,
    },
    new Date(),
    isAdmin
  );
  if (rule === 'blocked') {
    res.status(400).json({
      error: `Settle it first. Unsettled slips can only be deleted within ${DELETE_GRACE_MINUTES} minutes of posting.`,
    });
    return;
  }
  if (rule === 'remove') {
    await prisma.post.delete({ where: { id: post.id } });
  } else {
    await prisma.post.update({
      where: { id: post.id },
      data: { deletedAt: new Date() },
    });
  }
  res.status(204).end();
});

export default router;
