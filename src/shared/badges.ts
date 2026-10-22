import type { FeedPost } from './posts';
import type { Streak } from './stats';

// When a poster or slip earns a badge. Thresholds are tuned for one friend
// group; change them here and both the tests and the cards follow.

/** Wins in a row before a poster shows as hot */
export const HOT_STREAK = 3;
/** A winning bet at these odds or longer is a big win */
export const BIG_WIN_ODDS = 400;
/** Tails before a slip counts as a "Group lock" */
export const POPULAR_TAILS = 3;

export const isHot = (streak: Streak | null): streak is Streak =>
  !!streak && streak.kind === 'W' && streak.count >= HOT_STREAK;

export type SlipBadge =
  /** Hit at +400 or longer; `odds` is the longest winning price */
  | { kind: 'BIG_WIN'; odds: number }
  /** Every rung of a ladder hit */
  | { kind: 'SWEEP'; rungs: number }
  | { kind: 'POPULAR'; tails: number };

export function slipBadges(post: FeedPost): SlipBadge[] {
  const badges: SlipBadge[] = [];
  const winningOdds = post.bets
    .filter((b) => b.result === 'WON')
    .map((b) => b.americanOdds);
  const longest = Math.max(...winningOdds, -Infinity);
  if (longest >= BIG_WIN_ODDS) badges.push({ kind: 'BIG_WIN', odds: longest });

  const live = post.bets.filter((b) => b.result !== 'VOID');
  if (
    post.type === 'LADDER' &&
    live.length >= 2 &&
    live.every((b) => b.result === 'WON')
  ) {
    badges.push({ kind: 'SWEEP', rungs: live.length });
  }

  // A ladder tail lands on every rung, so the busiest rung is the slip's count
  const tails = Math.max(0, ...post.bets.map((b) => b.tailCount));
  if (tails >= POPULAR_TAILS) badges.push({ kind: 'POPULAR', tails });
  return badges;
}
