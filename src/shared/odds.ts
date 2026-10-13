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
