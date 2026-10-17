import type { PersonRef } from './social';
import { betNet, StatBet, StatLine, Streak } from './stats';

// The feed's side column: who's hot, the weekly leaderboard, and the
// community's green/red days.

/** "YYYY-MM-DD" for an instant in a time zone (falls back to UTC) */
export function dayKey(date: Date, timeZone: string): string {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export const isTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export type DayTotal = {
  /** YYYY-MM-DD */
  day: string;
  /** Everyone's net units on bets posted that day */
  net: number;
  /** Settled bets that day */
  bets: number;
};

/** Net units per day (by post date) for every day with a settled bet */
export function dailyTotals(
  bets: Pick<StatBet, 'createdAt' | 'units' | 'decimalOdds' | 'result'>[],
  timeZone: string
): DayTotal[] {
  const days = new Map<string, DayTotal>();
  bets.forEach((b) => {
    if (b.result === 'PENDING' || b.result === 'VOID') return;
    const day = dayKey(b.createdAt, timeZone);
    const total = days.get(day) ?? { day, net: 0, bets: 0 };
    total.net += betNet(b);
    total.bets += 1;
    days.set(day, total);
  });
  return [...days.values()]
    .map((d) => ({ ...d, net: Math.round(d.net * 100) / 100 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export type HotUser = PersonRef & { streak: Streak };
export type LeaderRow = PersonRef & { line: StatLine };

export type CommunityStats = {
  /** Posters on a hot win streak, longest first */
  hot: HotUser[];
  /** Top earners over the last 7 days (only people up units), best first */
  leaders: LeaderRow[];
  /** Settled days in the requested month */
  days: DayTotal[];
  /** The month `days` covers, YYYY-MM */
  month: string;
  /** Group parlays' own record; never part of anyone's personal stats */
  group: {
    wins: number;
    losses: number;
    pushes: number;
    /** Still open or waiting on legs */
    open: number;
    /** Each person's graded legs, most hits first */
    legs: (PersonRef & { hit: number; busted: number })[];
  };
};
