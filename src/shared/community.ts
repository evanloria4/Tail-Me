import type { PersonRef } from './social';
import { betNet, StatBet, StatLine, Streak } from './stats';
import { siteDayKey } from './time';

// The feed's side column: who's hot, the weekly leaderboard, and the
// community's green/red days (Central time, like the rest of the site).

export type DayTotal = {
  /** YYYY-MM-DD */
  day: string;
  /** Everyone's net units on bets posted that day */
  net: number;
  /** Settled bets that day */
  bets: number;
};

/** Net units per Central day (by post date) for every day with a settled bet */
export function dailyTotals(
  bets: Pick<StatBet, 'createdAt' | 'units' | 'decimalOdds' | 'result'>[]
): DayTotal[] {
  const days = new Map<string, DayTotal>();
  bets.forEach((b) => {
    if (b.result === 'PENDING' || b.result === 'VOID') return;
    const day = siteDayKey(b.createdAt);
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
    legs: (PersonRef & {
      hit: number;
      busted: number;
      /** Parlays that lost on their leg alone */
      onlyMiss: number;
    })[];
  };
};
