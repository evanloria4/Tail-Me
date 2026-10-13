import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { Prisma } from '../../generated/prisma/client';
import { requireAuth, requireSubscription } from '../middleware/auth';
import {
  americanToDecimal,
  decimalToAmerican,
  parlayDecimal,
} from '../../shared/odds';
import {
  createPostSchema,
  CreatePostInput,
  FeedPost,
  LegInput,
  MarketKey,
} from '../../shared/posts';

const router = Router();
const PAGE_SIZE = 20;

const feedInclude = {
  author: {
    select: { id: true, username: true, fullName: true, avatarUrl: true },
  },
  sportsbook: { select: { key: true, name: true } },
  bets: {
    orderBy: { order: 'asc' },
    include: {
      legs: { orderBy: { order: 'asc' } },
      _count: { select: { tails: true } },
    },
  },
} satisfies Prisma.PostInclude;

type PostWithFeed = Prisma.PostGetPayload<{ include: typeof feedInclude }>;

function toFeedPost(post: PostWithFeed): FeedPost {
  return {
    id: post.id,
    type: post.type,
    caption: post.caption,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    sportsbook: post.sportsbook,
    bets: post.bets.map((bet) => ({
      id: bet.id,
      order: bet.order,
      units: bet.units.toNumber(),
      americanOdds: bet.americanOdds,
      decimalOdds: bet.decimalOdds.toNumber(),
      result: bet.result,
      deepLink: bet.deepLink,
      tailCount: bet._count.tails,
      legs: bet.legs.map((leg) => ({
        id: leg.id,
        sportKey: leg.sportKey,
        eventLabel: leg.eventLabel,
        marketKey: leg.marketKey as MarketKey,
        marketLabel: leg.marketLabel,
        playerName: leg.playerName,
        selection: leg.selection,
        line: leg.line?.toNumber() ?? null,
        americanOdds: leg.americanOdds,
        deepLink: leg.deepLink,
      })),
    })),
  };
}

function legData(leg: LegInput, order: number) {
  return {
    order,
    sportKey: leg.sportKey,
    eventLabel: leg.eventLabel,
    marketKey: leg.marketKey,
    marketLabel: leg.marketKey === 'player_prop' ? leg.marketLabel : null,
    playerName: leg.marketKey === 'player_prop' ? leg.playerName : null,
    selection: leg.selection,
    line: leg.marketKey === 'h2h' ? null : (leg.line ?? null),
    americanOdds: leg.americanOdds,
  };
}

/** Turns validated input into Bet rows (one for straight/parlay, one per ladder rung) */
function betsData(input: CreatePostInput) {
  switch (input.type) {
    case 'STRAIGHT':
      return [
        {
          order: 0,
          units: input.units,
          americanOdds: input.leg.americanOdds,
          decimalOdds: americanToDecimal(input.leg.americanOdds),
          legs: { create: [legData(input.leg, 0)] },
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
          americanOdds: input.slipOdds ?? decimalToAmerican(decimal),
          decimalOdds: decimal,
          legs: { create: input.legs.map(legData) },
        },
      ];
    }
    case 'LADDER':
      return input.rungs.map((rung, i) => ({
        order: i,
        units: rung.units,
        americanOdds: rung.americanOdds,
        decimalOdds: americanToDecimal(rung.americanOdds),
        legs: {
          create: [legData({ ...input.pick, ...rung }, 0)],
        },
      }));
    default:
      throw new Error('Unknown post type');
  }
}

function sportKeysOf(input: CreatePostInput): string[] {
  if (input.type === 'STRAIGHT') return [input.leg.sportKey];
  if (input.type === 'PARLAY') return input.legs.map((l) => l.sportKey);
  return [input.pick.sportKey];
}

/** Feed: everyone's posts, newest first. `?cursor=<last post id>` for the next page. */
router.get('/', requireAuth, async (req, res) => {
  const cursor =
    typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const posts = await prisma.post.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: feedInclude,
  });
  const hasMore = posts.length > PAGE_SIZE;
  const page = posts.slice(0, PAGE_SIZE);
  res.json({
    posts: page.map(toFeedPost),
    nextCursor: hasMore ? page[page.length - 1].id : null,
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
  const sportKeys = [...new Set(sportKeysOf(input))];
  const sportCount = await prisma.sport.count({
    where: { key: { in: sportKeys }, active: true },
  });
  if (sportCount !== sportKeys.length) {
    res.status(400).json({ error: 'Unknown sport' });
    return;
  }

  const post = await prisma.post.create({
    data: {
      authorId: req.user!.id,
      type: input.type,
      caption: input.caption || null,
      sportsbookId: sportsbook.id,
      bets: { create: betsData(input) },
    },
    include: feedInclude,
  });
  res.status(201).json(toFeedPost(post));
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
      include: { post: { select: { authorId: true, deletedAt: true } } },
    });
    if (!bet || bet.post.deletedAt) {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    if (bet.post.authorId !== req.user!.id) {
      res.status(403).json({ error: 'Only the poster can settle this bet' });
      return;
    }
    const { result } = parsed.data;
    await prisma.bet.update({
      where: { id: bet.id },
      data: { result, settledAt: result === 'PENDING' ? null : new Date() },
    });
    res.json({ ok: true });
  }
);

router.delete<{ postId: string }>('/:postId', requireAuth, async (req, res) => {
  const { count } = await prisma.post.updateMany({
    where: { id: req.params.postId, authorId: req.user!.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (!count) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.status(204).end();
});

export default router;
