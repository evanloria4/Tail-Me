import type { StatLine } from '../../shared/stats';

// How records and units read on profiles and the feed sidebar

/** "7-4" or "7-4-1" with pushes */
export const record = (l: StatLine) =>
  `${l.wins}-${l.losses}${l.pushes ? `-${l.pushes}` : ''}`;

/** "+2.40u" / "-1.00u" */
export const signedUnits = (n: number) =>
  `${n > 0 ? '+' : ''}${(Math.round(n * 100) / 100).toFixed(2)}u`;

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
