import type { BetResult } from './posts';
import { isOneLegMiss } from './records';
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

/**
 * The Central day a bet belongs to for "Today": the day of its last game
 * (a late game graded after midnight still counts for the night it was
 * played; a parlay across two days counts when it resolves). Bets with no
 * game attached fall back to the day they were posted.
 */
export function gameDay(gameStarts: (Date | null)[], postedAt: Date): string {
  const starts = gameStarts.filter((d): d is Date => d !== null);
  if (!starts.length) return siteDayKey(postedAt);
  return siteDayKey(new Date(Math.max(...starts.map((d) => d.getTime()))));
}

/** A settled personal bet, for the day's superlatives */
export type TodayBet = {
  authorId: string;
  units: number;
  americanOdds: number;
  decimalOdds: number;
  result: BetResult;
  /** Every leg's result (one entry for straights and ladder rungs) */
  legs: BetResult[];
};

/** One "Today" card on the feed */
export type DaySuperlative = {
  key: 'biggest' | 'topEarner' | 'worstBeat' | 'roughDay';
  icon: string;
  title: string;
  person: PersonRef;
  value: string;
  detail: string;
};

const signedOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}u`;

/**
 * The day's standouts from bets on today's games: the longest price that
 * cashed, who won and lost the most units, and a parlay (3+ legs) that lost
 * on one leg. Each appears only when someone qualifies, in this order.
 */
export function daySuperlatives(
  people: PersonRef[],
  bets: TodayBet[]
): DaySuperlative[] {
  const who = new Map(people.map((p) => [p.id, p]));
  const out: DaySuperlative[] = [];
  const add = (card: Omit<DaySuperlative, 'person'>, personId: string) => {
    const person = who.get(personId);
    if (person) out.push({ ...card, person });
  };

  const biggest = bets
    .filter((b) => b.result === 'WON')
    .sort((a, b) => b.americanOdds - a.americanOdds)[0];
  if (biggest) {
    add(
      {
        key: 'biggest',
        icon: '💰',
        title: 'Biggest hit',
        value: signedOdds(biggest.americanOdds),
        detail: `$10 paid $${Math.round(10 * biggest.decimalOdds)}`,
      },
      biggest.authorId
    );
  }

  const nets = new Map<string, number>();
  bets.forEach((b) =>
    nets.set(b.authorId, (nets.get(b.authorId) ?? 0) + betNet(b))
  );
  const byNet = [...nets].sort((a, b) => b[1] - a[1]);
  const [topId, topNet] = byNet[0] ?? [];
  if (topId && topNet > 0) {
    add(
      {
        key: 'topEarner',
        icon: '📈',
        title: 'Top earner',
        value: signed(topNet),
        detail: 'won today',
      },
      topId
    );
  }

  const beat = bets
    .filter((b) => b.legs.length >= 3 && isOneLegMiss(b.result, b.legs))
    .sort((a, b) => b.americanOdds - a.americanOdds)[0];
  if (beat) {
    add(
      {
        key: 'worstBeat',
        icon: '💔',
        title: 'Worst beat',
        value: signedOdds(beat.americanOdds),
        detail: `${beat.legs.length - 1}/${beat.legs.length} legs hit`,
      },
      beat.authorId
    );
  }

  const [lowId, lowNet] = byNet[byNet.length - 1] ?? [];
  if (lowId && lowNet < 0) {
    add(
      {
        key: 'roughDay',
        icon: '📉',
        title: 'Rough day',
        value: signed(lowNet),
        detail: 'lost today',
      },
      lowId
    );
  }
  return out;
}

export type HotUser = PersonRef & { streak: Streak };
export type LeaderRow = PersonRef & { line: StatLine };

export type CommunityStats = {
  /** Today's standouts (bets settled today, Central), best first */
  today: DaySuperlative[];
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
