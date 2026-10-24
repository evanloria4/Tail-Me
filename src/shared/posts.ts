import { z } from 'zod';
import { decimalToAmerican, isValidAmerican, parlayDecimal } from './odds';
import { isOneSidedMarket } from './markets';
import type { SeriesRef } from './series';
import type { PersonRef, ReactionSummary } from './social';
import type { Streak } from './stats';

// Validation + shapes for creating posts, shared by the slip builder and the API

export const MARKETS = {
  h2h: 'Moneyline',
  spreads: 'Spread',
  totals: 'Total',
  player_prop: 'Player prop',
} as const;

export type MarketKey = keyof typeof MARKETS;

const americanOdds = z
  .number()
  .refine(isValidAmerican, 'Odds must be a whole number like -110 or +150');

const units = z
  .number({ error: 'Enter units (0 is fine)' })
  .nonnegative("Units can't be negative")
  .max(100, 'Max 100 units');

const text = (max: number) => z.string().trim().min(1).max(max);

/** Set when a pick comes from live odds; drives tailing into the book */
const bookRef = {
  bookSelectionId: text(200).optional(),
  deepLink: z.string().url().max(1000).optional(),
};

/** The pick itself, without price — shared by single legs and ladder rungs */
const pickSchema = z.object({
  sportKey: text(64),
  /** Odds API event id, when picked from live odds */
  eventId: text(64).optional(),
  eventLabel: text(80),
  marketKey: z.enum(Object.keys(MARKETS) as [MarketKey, ...MarketKey[]]),
  marketLabel: text(40).optional(),
  playerName: text(60).optional(),
  selection: text(80),
});

function checkPick(
  pick: z.infer<typeof pickSchema> & { line?: number | null },
  ctx: z.RefinementCtx,
  requireLine: boolean
) {
  const needsLine = pick.marketKey === 'spreads' || pick.marketKey === 'totals';
  if (requireLine && needsLine && pick.line == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'Line is required',
      path: ['line'],
    });
  }
  if (pick.marketKey === 'player_prop') {
    if (!pick.playerName)
      ctx.addIssue({
        code: 'custom',
        message: 'Player is required',
        path: ['playerName'],
      });
    if (!pick.marketLabel)
      ctx.addIssue({
        code: 'custom',
        message: 'Prop type is required',
        path: ['marketLabel'],
      });
  }
}

export const legSchema = pickSchema
  .extend({ line: z.number().nullable().optional(), americanOdds, ...bookRef })
  .superRefine((leg, ctx) => checkPick(leg, ctx, true));

const base = {
  sportsbookKey: text(64),
  caption: z.string().trim().max(500).optional(),
};

/** Personal slips can be filed under one of the author's series */
const personal = { ...base, seriesId: z.string().min(1).max(64).optional() };

export const createPostSchema = z.discriminatedUnion('type', [
  z.object({
    ...personal,
    type: z.literal('STRAIGHT'),
    units,
    leg: legSchema,
  }),
  z.object({
    ...personal,
    type: z.literal('PARLAY'),
    units,
    legs: z.array(legSchema).min(2, 'A parlay needs at least 2 legs').max(20),
    /** Book's slip price; overrides the multiplied legs (e.g. same-game parlays) */
    slipOdds: americanOdds.optional(),
  }),
  z.object({
    ...personal,
    type: z.literal('LADDER'),
    pick: pickSchema.superRefine((p, ctx) => checkPick(p, ctx, false)),
    rungs: z
      .array(z.object({ line: z.number(), americanOdds, units, ...bookRef }))
      .min(2, 'A ladder needs at least 2 rungs')
      .max(10)
      .refine(
        (rungs) => new Set(rungs.map((r) => r.line)).size === rungs.length,
        'Each rung needs a different line'
      ),
  }),
  z.object({
    ...base,
    type: z.literal('GROUP_PARLAY'),
    /** No more legs after this; the server checks it's in the future */
    lockAt: z.iso.datetime({ offset: true }),
    /** The creator's own leg; friends add theirs with `joinGroupSchema` */
    leg: legSchema,
    /** Keep every leg to the creator's game (needs a live-odds leg) */
    gameOnly: z.boolean().optional(),
  }),
]);

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type LegInput = z.infer<typeof legSchema>;

// ---------- Group parlays ----------

/** Most legs a group parlay can hold (one per friend) */
export const GROUP_MAX_LEGS = 12;
/** Furthest out a lock deadline can be set */
export const GROUP_MAX_LOCK_DAYS = 7;

export const joinGroupSchema = z.object({ leg: legSchema });

/** The book's own price for the locked slip (same-game parlays price below the legs multiplied) */
export const groupPriceSchema = z.object({ americanOdds });

/** A bet's stake, changed after posting (⋯ → Change units) */
export const betUnitsSchema = z.object({ units });

/**
 * Legs all from one game. Books price those with their own correlation
 * models, so multiplying the legs only estimates it until the creator enters
 * the book's price.
 */
export const isSameGameLegs = (legs: { eventLabel: string }[]) =>
  legs.length > 1 && legs.every((l) => l.eventLabel === legs[0].eventLabel);

/** Open for legs until the creator locks it or the deadline passes */
export function isGroupLocked(
  group: { lockAt: string | Date; lockedAt: string | Date | null },
  now = new Date()
): boolean {
  return !!group.lockedAt || new Date(group.lockAt) <= now;
}

/**
 * A group parlay's result from its legs: any loss sinks it, it stays pending
 * while a leg is open, voided legs drop out, and all pushes is a push.
 */
export function groupResult(legs: BetResult[]): BetResult {
  if (legs.includes('LOST')) return 'LOST';
  if (legs.includes('PENDING')) return 'PENDING';
  const live = legs.filter((r) => r !== 'VOID');
  if (!live.length) return 'VOID';
  return live.every((r) => r === 'PUSH') ? 'PUSH' : 'WON';
}

// ---------- API response shapes ----------

export type BetResult = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'VOID';

export type FeedLeg = {
  id: string;
  sportKey: string;
  eventLabel: string;
  marketKey: MarketKey;
  marketLabel: string | null;
  playerName: string | null;
  selection: string;
  line: number | null;
  americanOdds: number;
  deepLink: string | null;
  /** The game (null on old typed-in legs), when it starts, and if it's over */
  eventId: string | null;
  startsAt: string | null;
  gameFinal: boolean;
  /** Away-home score and clock ("Q3 4:12", "Final") once the game is on */
  score: { away: number; home: number; clock: string } | null;
  /** Per-leg result: auto-graded from the game, or set by hand on group parlays */
  result: BetResult;
  /** The stat a graded prop finished on, e.g. 212 (passing yards) */
  actual: number | null;
  /** Group parlays: whose leg it is */
  addedBy: PersonRef | null;
};

export type FeedBet = {
  id: string;
  order: number;
  units: number;
  americanOdds: number;
  decimalOdds: number;
  result: BetResult;
  deepLink: string | null;
  tailCount: number;
  /** Whether the viewer has tailed this bet */
  tailedByMe: boolean;
  legs: FeedLeg[];
};

export type FeedPost = {
  id: string;
  type: 'STRAIGHT' | 'PARLAY' | 'LADDER' | 'GROUP_PARLAY';
  caption: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    /** Monogram background when there's no photo */
    avatarColor: string;
    /** Current all-time run of wins or losses */
    streak: Streak | null;
  };
  sportsbook: { key: string; name: string };
  bets: FeedBet[];
  reactions: ReactionSummary[];
  /** The author's series it's filed under */
  series: SeriesRef | null;
  /** Set on group parlays only */
  group: {
    lockAt: string;
    lockedAt: string | null;
    /** Set when every leg has to come from this one game */
    game: { eventId: string; eventLabel: string; sportKey: string } | null;
  } | null;
  commentCount: number;
  /** Distinct people who tailed, and the latest few for the avatar stack */
  tailers: { count: number; recent: PersonRef[] };
  /** People betting against it (never alongside a tail) */
  fadeCount: number;
  fadedByMe: boolean;
};

/** One-line description of a leg, e.g. "Chiefs -3.5", "Over 47.5", "Mahomes Over 1.5 Passing TDs" */
export function describeLeg(
  leg: Pick<
    FeedLeg,
    'marketKey' | 'selection' | 'line' | 'playerName' | 'marketLabel'
  >
): string {
  const line = leg.line == null ? '' : ` ${leg.line}`;
  switch (leg.marketKey) {
    case 'h2h':
      return `${leg.selection} ML`;
    case 'spreads':
      return `${leg.selection} ${leg.line != null && leg.line > 0 ? '+' : ''}${leg.line ?? ''}`;
    case 'player_prop':
      return `${leg.playerName} ${leg.selection}${line} ${leg.marketLabel}`;
    default:
      return `${leg.selection}${line}`;
  }
}

/**
 * Whether a group parlay's price came from the book rather than its legs
 * multiplied. Legs are fixed once it locks, so a different number means the
 * creator entered the book's price.
 */
export function hasBookPrice(bet: {
  americanOdds: number;
  legs: { americanOdds: number }[];
}): boolean {
  if (!bet.legs.length) return false;
  const multiplied = decimalToAmerican(
    parlayDecimal(bet.legs.map((l) => l.americanOdds))
  );
  return bet.americanOdds !== multiplied;
}

// ---------- Deleting ----------

/** Minutes after posting that an unsettled slip can still be taken back */
export const DELETE_GRACE_MINUTES = 15;

/**
 * What deleting a slip does, so records can't be gamed by deleting losers:
 * - 'hide': settled; it leaves the feed but still counts toward records
 * - 'remove': posted by mistake (unsettled, within the grace window) or a
 *   group parlay that hasn't locked; it's gone entirely
 * - 'blocked': unsettled and past the grace window; settle it first
 *
 * Admins (`asAdmin`) are never blocked: an unsettled slip of anyone's is
 * removed, since it never counted. Settled ones are still only hidden.
 */
export type DeleteRule = 'hide' | 'remove' | 'blocked';

export function deleteRule(
  post: {
    createdAt: string | Date;
    type: FeedPost['type'];
    group: { lockAt: string | Date; lockedAt: string | Date | null } | null;
    bets: { result: BetResult }[];
  },
  now = new Date(),
  asAdmin = false
): DeleteRule {
  if (post.type === 'GROUP_PARLAY' && post.group) {
    if (!isGroupLocked(post.group, now)) return 'remove';
  }
  if (!post.bets.some((b) => b.result === 'PENDING')) return 'hide';
  const age = now.getTime() - new Date(post.createdAt).getTime();
  return asAdmin || age < DELETE_GRACE_MINUTES * 60_000 ? 'remove' : 'blocked';
}

/**
 * Fade (betting against a slip) is for straight bets with a real other side:
 * not parlays, ladders or group parlays, and not one-sided scorer props.
 * Picked props are stored as `player_prop`, so one-sided ones (Anytime TD /
 * Goal) are told apart by their "Yes" selection.
 */
export function canBeFaded(
  type: FeedPost['type'],
  legs: { marketKey: string; selection: string }[]
): boolean {
  return (
    type === 'STRAIGHT' &&
    !legs.some((l) => l.selection === 'Yes' || isOneSidedMarket(l.marketKey))
  );
}

// ---------- Group parlay legs ----------

type SlotLeg = {
  eventId?: string | null;
  eventLabel: string;
  marketKey: string;
  marketLabel?: string | null;
  playerName?: string | null;
};

const slotPart = (s: string | null | undefined) =>
  (s ?? '').trim().toLowerCase();

/**
 * The market a group parlay leg takes up: a game's moneyline, spread or
 * total (alternate lines included), or one player's prop. A group parlay
 * holds one leg per market, since FanDuel won't parlay two picks from the
 * same one (that covers the same pick twice, the other side and other lines).
 */
export function legMarketSlot(leg: SlotLeg): string {
  const game = leg.eventId || slotPart(leg.eventLabel);
  return leg.marketKey === 'player_prop'
    ? [game, 'prop', slotPart(leg.marketLabel), slotPart(leg.playerName)].join(
        '|'
      )
    : [game, leg.marketKey].join('|');
}

/** "Bo Nix Passing Yards", "Seahawks @ Broncos spread" */
export function legMarketName(leg: SlotLeg): string {
  if (leg.marketKey === 'player_prop') {
    return `${leg.playerName ?? 'That player'} ${leg.marketLabel ?? 'prop'}`;
  }
  const market = MARKETS[leg.marketKey as MarketKey] ?? 'market';
  return `${leg.eventLabel} ${market.toLowerCase()}`;
}

// ---------- Editing ----------

/**
 * Whether the author can still change a slip's legs, units and price:
 * straights and parlays only, nothing graded, and no game on it started yet
 * (so a leg that's already losing can't be dropped). Ladders and group
 * parlays stay as posted. Admins (`asAdmin`) can edit anyone's straight or
 * parlay any time, graded or not, to clean up a friend's mistakes.
 */
export function canEditSlip(
  post: {
    type: FeedPost['type'];
    bets: {
      result: BetResult;
      legs: { result: BetResult; startsAt: string | Date | null }[];
    }[];
  },
  now = new Date(),
  asAdmin = false
): boolean {
  if (post.type !== 'STRAIGHT' && post.type !== 'PARLAY') return false;
  if (asAdmin) return true;
  return post.bets.every(
    (b) =>
      b.result === 'PENDING' &&
      b.legs.every(
        (l) =>
          l.result === 'PENDING' &&
          (!l.startsAt || new Date(l.startsAt).getTime() > now.getTime())
      )
  );
}

// ---------- Ladder rungs ----------

/** Most rungs a ladder can hold, posted or added later */
export const LADDER_MAX_RUNGS = 10;

/**
 * Whether a rung can be added to a ladder: the author pregame (nothing graded,
 * no game started), admins any time. Either way it needs room.
 */
export function canAddRung(
  post: {
    type: FeedPost['type'];
    bets: {
      result: BetResult;
      legs: { result: BetResult; startsAt: string | Date | null }[];
    }[];
  },
  now = new Date(),
  asAdmin = false
): boolean {
  if (post.type !== 'LADDER' || post.bets.length >= LADDER_MAX_RUNGS)
    return false;
  if (asAdmin) return true;
  return post.bets.every(
    (b) =>
      b.result === 'PENDING' &&
      b.legs.every(
        (l) =>
          l.result === 'PENDING' &&
          (!l.startsAt || new Date(l.startsAt).getTime() > now.getTime())
      )
  );
}

/**
 * The next rung up a ladder: one more step past its longest price, the step
 * being the gap between its two longest prices. Works whichever way the
 * ladder climbs (Overs up, Unders and favorites down). `step` is what the
 * line moves by when nudged (always positive).
 */
export function nextRung(
  rungs: { line: number | null; americanOdds: number; units: number }[]
): { line: number; step: number; units: number } {
  const byPrice = rungs
    .filter((r): r is typeof r & { line: number } => r.line != null)
    .sort((a, b) => b.americanOdds - a.americanOdds);
  const [top, second] = byPrice;
  if (!top) return { line: 0, step: 1, units: 1 };
  const gap = second ? top.line - second.line : 0;
  const step = Math.round(Math.abs(gap) * 100) / 100 || 1;
  const line = Math.round((top.line + (gap || step)) * 100) / 100;
  return { line, step, units: top.units };
}

/** A rung added to a posted ladder; the pick comes from the ladder itself */
export const addRungSchema = z.object({
  line: z.number(),
  americanOdds,
  units,
});

/**
 * Edit a straight / parlay: the legs to keep (by id), new legs from live
 * odds, and the stake. One leg left makes it a straight, two or more a
 * parlay; `slipOdds` (parlays) is the book's price, overriding the legs
 * multiplied.
 */
export const editPostSchema = z
  .object({
    units,
    keepLegIds: z.array(z.string().min(1).max(64)).max(20),
    legs: z.array(legSchema).max(20),
    slipOdds: americanOdds.optional(),
    caption: z.string().trim().max(500).optional(),
  })
  .refine(
    (e) => e.keepLegIds.length + e.legs.length >= 1,
    'A slip needs at least 1 pick'
  )
  .refine(
    (e) => e.keepLegIds.length + e.legs.length <= 20,
    'A parlay can have at most 20 legs'
  );

export type EditPostInput = z.infer<typeof editPostSchema>;

/**
 * Feed filters (GET /posts?status=). Open: anything still waiting on a
 * result. Live: a game on the slip is being played. Won / Lost: settled;
 * ladders by their final net units (up is Won, down is Lost; at exactly
 * even, more hits than misses is Won and the reverse Lost). All: every slip,
 * pushes and voids included.
 */
export const FEED_FILTERS = ['open', 'live', 'won', 'lost', 'all'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];
export const isFeedFilter = (v: unknown): v is FeedFilter =>
  typeof v === 'string' && (FEED_FILTERS as readonly string[]).includes(v);
