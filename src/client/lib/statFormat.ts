import type { StatLine } from '../../shared/stats';

// How records and units read on profiles and the feed sidebar

/** "7-4" or "7-4-1" with pushes */
export const record = (l: StatLine) =>
  `${l.wins}-${l.losses}${l.pushes ? `-${l.pushes}` : ''}`;

/** "+2.40u" / "-1.00u" */
export const signedUnits = (n: number) =>
  `${n > 0 ? '+' : ''}${(Math.round(n * 100) / 100).toFixed(2)}u`;

/**
 * Units in at most 4 digits, for tight spots: "+3.48u", "+12.34u",
 * "+123.4u", "+1234u" (drops decimals as the number grows)
 */
export function shortUnits(n: number) {
  const size = Math.abs(n);
  const digits = [2, 1, 0]
    .map((d) => size.toFixed(d))
    .find((s) => s.replace('.', '').replace(/^0+(?=\d)/, '').length <= 4);
  const text = digits ?? size.toFixed(0);
  // No sign on a value that rounds to zero
  let sign = '';
  if (Number(text)) sign = n > 0 ? '+' : '-';
  return `${sign}${text}u`;
}

export const pct = (n: number | null, signed = false) => {
  if (n == null) return '–';
  const v = Math.round(n * 1000) / 10;
  return `${signed && v > 0 ? '+' : ''}${v}%`;
};

export const winPct = (l: StatLine) =>
  l.wins + l.losses ? l.wins / (l.wins + l.losses) : null;

/** Green up, red down, plain when flat */
export const netColor = (n: number) => {
  if (n > 0) return 'text-win';
  if (n < 0) return 'text-red-400';
  return '';
};

export const settledCount = (l: StatLine) => l.wins + l.losses + l.pushes;
