// Odds math shared by client (live slip preview) and server (stored totals)

/** American odds must be <= -100 or >= +100 */
export function isValidAmerican(odds: number): boolean {
  return Number.isInteger(odds) && Math.abs(odds) >= 100;
}

export function americanToDecimal(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) throw new Error('Decimal odds must be greater than 1');
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
}

/** Parlay price: product of each leg's decimal odds */
export function parlayDecimal(legOdds: number[]): number {
  return legOdds.reduce((acc, odds) => acc * americanToDecimal(odds), 1);
}

/** Biggest profit boost a bet can take, in percent */
export const MAX_BOOST_PCT = 1000;

/**
 * A profit boost raises the winnings, not the stake, like the books' own:
 * +200 with a 25% boost pays +250.
 */
export function boostDecimal(decimal: number, pct: number): number {
  return 1 + (decimal - 1) * (1 + pct / 100);
}

/**
 * What a bet stores for its price: the book's regular odds, or with a boost
 * the boosted ones (so payouts and stats count it) plus the regular odds to
 * strike through. Always recompute from the regular odds.
 */
export function betPrice(
  regular: { americanOdds: number; decimalOdds: number },
  boostPct: number | null | undefined
) {
  if (!boostPct) {
    return { ...regular, boostPct: null, regularOdds: null };
  }
  const decimalOdds = boostDecimal(regular.decimalOdds, boostPct);
  return {
    americanOdds: decimalToAmerican(decimalOdds),
    decimalOdds,
    boostPct,
    regularOdds: regular.americanOdds,
  };
}

/** Total return (stake included) of a bet at the given decimal odds — "$10 pays $X" */
export function payout(stake: number, decimal: number): number {
  return Math.round(stake * decimal * 100) / 100;
}

export function formatAmerican(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
