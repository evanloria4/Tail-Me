import type { FeedBet, FeedPost } from './posts';
import type { Streak } from './stats';

// When a poster or slip earns a badge. Thresholds are tuned for one friend
// group; change them here and both the tests and the cards follow.

/** Wins in a row before a poster shows as hot */
export const HOT_STREAK = 3;
/**
 * Win tiers: the longer the price that hit, the louder the slip. Each is the
 * lowest American price for that tier (+200 = $10 pays $30, a 3x return).
 */
export const WIN_TIERS = [
  { tier: 1, name: 'Nice hit', odds: 200 },
  { tier: 2, name: 'Cashed', odds: 400 },
  { tier: 3, name: 'Big score', odds: 900 },
  { tier: 4, name: 'Jackpot', odds: 2400 },
] as const;
export type WinTier = (typeof WIN_TIERS)[number]['tier'];
/** A clean ladder sweep shows at least this tier */
export const SWEEP_TIER: WinTier = 2;
/** Tails before a slip counts as a "Group lock" */
export const POPULAR_TAILS = 3;

export const isHot = (streak: Streak | null): streak is Streak =>
  !!streak && streak.kind === 'W' && streak.count >= HOT_STREAK;

export type SlipBadge =
  /** Hit at +200 or longer; `odds` is the longest winning price */
  | { kind: 'WIN'; tier: WinTier; odds: number; decimal: number }
  /** Every rung of a ladder hit */
  | { kind: 'SWEEP'; rungs: number }
  | { kind: 'POPULAR'; tails: number };

/** The tier a winning price reaches, or null below the first */
export function tierFor(americanOdds: number): WinTier | null {
  const hit = [...WIN_TIERS].reverse().find((t) => americanOdds >= t.odds);
  return hit ? hit.tier : null;
}

/** How loudly a slip celebrates: its win tier, lifted by a ladder sweep */
export function slipTier(badges: SlipBadge[]): WinTier | null {
  const tiers = badges.map((b) => {
    if (b.kind === 'WIN') return b.tier;
    return b.kind === 'SWEEP' ? SWEEP_TIER : 0;
  });
  const top = Math.max(0, ...tiers);
  return top ? (top as WinTier) : null;
}

export function slipBadges(post: FeedPost): SlipBadge[] {
  const badges: SlipBadge[] = [];
  // The longest price that hit sets the tier (a ladder's top winning rung)
  const longest = post.bets
    .filter((b) => b.result === 'WON')
    .reduce<FeedBet | null>(
      (best, b) => (!best || b.americanOdds > best.americanOdds ? b : best),
      null
    );
  const tier = longest && tierFor(longest.americanOdds);
  if (longest && tier) {
    badges.push({
      kind: 'WIN',
      tier,
      odds: longest.americanOdds,
      decimal: longest.decimalOdds,
    });
  }

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
