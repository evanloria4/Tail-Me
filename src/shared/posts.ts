import { z } from 'zod';
import { isValidAmerican } from './odds';
import type { ReactionSummary } from './social';
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
  .number()
  .positive('Units must be more than 0')
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

export const createPostSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('STRAIGHT'),
    units,
    leg: legSchema,
  }),
  z.object({
    ...base,
    type: z.literal('PARLAY'),
    units,
    legs: z.array(legSchema).min(2, 'A parlay needs at least 2 legs').max(20),
    /** Book's slip price; overrides the multiplied legs (e.g. same-game parlays) */
    slipOdds: americanOdds.optional(),
  }),
  z.object({
    ...base,
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
]);

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type LegInput = z.infer<typeof legSchema>;

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
  type: 'STRAIGHT' | 'PARLAY' | 'LADDER';
  caption: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    /** Current all-time run of wins or losses */
    streak: Streak | null;
  };
  sportsbook: { key: string; name: string };
  bets: FeedBet[];
  reactions: ReactionSummary[];
  commentCount: number;
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
