import type { BetResult, FeedPost } from './posts';
import type { NearMisses } from './records';

// Betting records, shared by the server (profile stats) and tests.
//
// Records count bets: a straight or parlay is one bet, and every ladder rung is
// its own win or loss. Voided bets don't count at all. A parlay that mixes
// leagues counts once overall but under no single league.

/** Personal post types; group parlays keep their own record */
export type PostType = Exclude<FeedPost['type'], 'GROUP_PARLAY'>;

export const POST_TYPES: PostType[] = ['STRAIGHT', 'PARLAY', 'LADDER'];

/** Posts that count toward personal records (not group parlays) */
export const isPersonalType = (t: string): t is PostType =>
  (POST_TYPES as string[]).includes(t);

/** One bet, plus the bits of its slip the breakdowns need */
export type StatBet = {
  type: PostType;
  /** League of every leg, or null when the legs span leagues */
  sportKey: string | null;
  /** When the slip was posted */
  createdAt: Date;
  /** Rung order within a ladder (0 otherwise) */
  order: number;
  units: number;
  decimalOdds: number;
  result: BetResult;
};

export type SettledResult = 'WON' | 'LOST' | 'PUSH';

export type StatLine = {
  wins: number;
  losses: number;
  pushes: number;
  /** Bets still waiting on a result */
  pending: number;
  /** Units staked on settled bets */
  risked: number;
  /** Units won minus units lost */
  net: number;
  /** net / risked, or null before anything is risked */
  roi: number | null;
};

export type Streak = { kind: 'W' | 'L'; count: number };

export type ProfileStats = {
  overall: StatLine;
  byType: Record<PostType, StatLine>;
  /** Single-league bets per league, busiest first */
  bySport: { sportKey: string; line: StatLine }[];
  /** Current run of wins or losses (pushes don't break it), ignoring the range */
  streak: Streak | null;
  /** Longest win streak in the range */
  bestWinStreak: number;
  /** Up to 10 most recent settled bets, newest first */
  recent: SettledResult[];
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Units a bet made or lost; pushes and voids are 0 */
export function betNet(bet: Pick<StatBet, 'units' | 'decimalOdds' | 'result'>) {
  if (bet.result === 'WON') return bet.units * (bet.decimalOdds - 1);
  if (bet.result === 'LOST') return -bet.units;
  return 0;
}

export function statLine(bets: StatBet[]): StatLine {
  const line: StatLine = {
    wins: 0,
    losses: 0,
    pushes: 0,
    pending: 0,
    risked: 0,
    net: 0,
    roi: null,
  };
  bets.forEach((b) => {
    if (b.result === 'VOID') return;
    if (b.result === 'PENDING') {
      line.pending += 1;
      return;
    }
    if (b.result === 'WON') line.wins += 1;
    else if (b.result === 'LOST') line.losses += 1;
    else line.pushes += 1;
    line.risked += b.units;
    line.net += betNet(b);
  });
  line.risked = round(line.risked);
  line.net = round(line.net);
  line.roi = line.risked > 0 ? line.net / line.risked : null;
  return line;
}

/** What streaks need from a bet (the feed passes just this) */
export type StreakBet = Pick<StatBet, 'createdAt' | 'order' | 'result'>;

/** Settled results, oldest first (ladder rungs in rung order) */
function settledResults(bets: StreakBet[]): SettledResult[] {
  return [...bets]
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() || a.order - b.order
    )
    .map((b) => b.result)
    .filter((r): r is SettledResult => r !== 'PENDING' && r !== 'VOID');
}

/** The latest `n` settled results, newest first (voids don't count) */
export const lastResults = (bets: StreakBet[], n: number) =>
  settledResults(bets).reverse().slice(0, n);

export function currentStreak(bets: StreakBet[]): Streak | null {
  const results = settledResults(bets).filter((r) => r !== 'PUSH');
  const last = results[results.length - 1];
  if (!last) return null;
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i -= 1) {
    count += 1;
  }
  return { kind: last === 'WON' ? 'W' : 'L', count };
}

export function bestWinStreak(bets: StreakBet[]): number {
  let best = 0;
  let run = 0;
  settledResults(bets).forEach((r) => {
    if (r === 'PUSH') return;
    run = r === 'WON' ? run + 1 : 0;
    best = Math.max(best, run);
  });
  return best;
}

// ---------- Date ranges ----------

export const STAT_RANGES = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
} as const;

export type StatRange = keyof typeof STAT_RANGES;

export const isStatRange = (v: unknown): v is StatRange =>
  typeof v === 'string' && v in STAT_RANGES;

/** Start of a range, or null for all time */
export function rangeStart(range: StatRange, now = new Date()): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
  return new Date(now.getTime() - days * 86400 * 1000);
}

export const sinceFilter = (since: Date | null) => (b: StatBet) =>
  !since || b.createdAt >= since;

/**
 * Stats for one user from all their bets. Everything but the current streak
 * is limited to bets posted since `since` (null = all time).
 */
export function profileStats(
  all: StatBet[],
  since: Date | null = null
): ProfileStats {
  const bets = all.filter(sinceFilter(since));
  const sportKeys = [
    ...new Set(
      bets.map((b) => b.sportKey).filter((k): k is string => k !== null)
    ),
  ];
  const bySport = sportKeys
    .map((sportKey) => ({
      sportKey,
      line: statLine(bets.filter((b) => b.sportKey === sportKey)),
    }))
    .sort(
      (a, b) =>
        b.line.wins + b.line.losses - (a.line.wins + a.line.losses) ||
        a.sportKey.localeCompare(b.sportKey)
    );
  return {
    overall: statLine(bets),
    byType: Object.fromEntries(
      POST_TYPES.map((t) => [t, statLine(bets.filter((b) => b.type === t))])
    ) as Record<PostType, StatLine>,
    bySport,
    // A short range shouldn't cut off a long streak
    streak: currentStreak(all),
    bestWinStreak: bestWinStreak(bets),
    recent: lastResults(bets, 10),
  };
}

// ---------- API response ----------

export type UserProfile = {
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    /** Monogram background when there's no photo */
    avatarColor: string;
    bio: string | null;
    createdAt: string;
  };
  range: StatRange;
  stats: ProfileStats;
  tails: {
    /** Times someone tailed one of their slips (one per person per slip) */
    received: number;
    /** Different people who have tailed them */
    tailers: number;
    /** How their tailed bets did */
    line: StatLine;
  };
  /** How the viewer has done tailing this user; null on your own profile or before your first tail */
  viewerTails: StatLine | null;
  /** Parlays in range that lost on one leg, and what they would have won */
  nearMisses: NearMisses;
};
