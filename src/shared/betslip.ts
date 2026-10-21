// One sportsbook link that loads several picks onto a single bet slip, built
// from the per-pick add-to-betslip links stored on each leg.
//
// FanDuel (verified 2026-10-20): repeating marketId/selectionId with indexes
// loads every pick; picks from one game come up as a same-game parlay with
// FanDuel's own price.
//   https://sportsbook.fanduel.com/addToBetslip?marketId[0]=42.1&selectionId[0]=5&marketId[1]=42.2&selectionId[1]=7

const FANDUEL_ADD = 'https://sportsbook.fanduel.com/addToBetslip';

function fanduelPick(link: string): [string, string] | null {
  try {
    const url = new URL(link);
    if (url.hostname !== 'sportsbook.fanduel.com') return null;
    if (url.pathname !== '/addToBetslip') return null;
    const market = url.searchParams.get('marketId');
    const selection = url.searchParams.get('selectionId');
    return market && selection ? [market, selection] : null;
  } catch {
    return null;
  }
}

/**
 * A single link that adds every pick, or null when any pick lacks a usable
 * link (typed-in legs, other books) so callers fall back to per-pick links.
 */
export default function combinedSlipLink(
  links: (string | null)[]
): string | null {
  if (links.length < 2) return null;
  const picks = links.map((l) => (l ? fanduelPick(l) : null));
  if (picks.some((p) => !p)) return null;
  const query = (picks as [string, string][])
    .map(
      ([market, selection], i) =>
        `marketId[${i}]=${encodeURIComponent(market)}&selectionId[${i}]=${encodeURIComponent(selection)}`
    )
    .join('&');
  return `${FANDUEL_ADD}?${query}`;
}
