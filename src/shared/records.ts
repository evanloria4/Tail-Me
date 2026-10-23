import type { BetResult } from './posts';
import type { PersonRef } from './social';
import {
  betNet,
  bestWinStreak,
  currentStreak,
  lastResults,
  SettledResult,
  StatBet,
  statLine,
  StatLine,
  StatRange,
  Streak,
} from './stats';
import { siteDayKey } from './time';

// The Records page: everyone's personal record side by side, each person's
// legs in group parlays, and a few superlatives. Same counting as profiles
// (shared/stats.ts): ladder rungs count one each, voids don't count, deleted
// slips still do. Group parlays only ever feed the group tab.

/** Settled bets before someone ranks on win % / ROI */
export const MIN_RANKED = 10;

/** One personal bet with what the records need beyond profile stats */
export type RecordBet = StatBet & {
  authorId: string;
  postId: string;
  americanOdds: number;
  /** Distinct people who tailed it */
  tails: number;
  /** People who faded the slip (straight bets only) */
  fades: number;
  /** Each leg's result (parlays; one entry otherwise) */
  legs: BetResult[];
};

/** One group parlay: its result and who added which leg */
export type RecordGroupParlay = {
  postId: string;
  createdAt: Date;
  result: BetResult;
  legs: { addedById: string | null; result: BetResult }[];
};

/** W-L-P with no units, for tail and fade records */
export type MiniRecord = { wins: number; losses: number; pushes: number };

export type LeaderRow = PersonRef & {
  line: StatLine;
  /** Last 5 settled bets, newest first; ignores the range like streaks */
  l5: SettledResult[];
  streak: Streak | null;
  bestStreak: number;
  /** How the people who faded them did (their loss is a fade win) */
  faded: MiniRecord;
};

export type GroupRow = PersonRef & {
  /** Group parlays they added a leg to */
  parlays: number;
  hit: number;
  busted: number;
  pending: number;
  /** Their leg was the only miss on a parlay that lost */
  onlyMiss: number;
  /** Parlays they were in that cashed */
  cashed: number;
  /** Their last 5 graded legs, newest first */
  l5: ('WON' | 'LOST')[];
};

export type Superlative = {
  key: 'biggest' | 'worstBeat' | 'streak' | 'bestDay' | 'mostTailed' | 'legs';
  title: string;
  person: PersonRef;
  /** The headline number, e.g. "+1450" or "+6.20u" */
  value: string;
  detail: string;
  /** The slip it's about, when there is one */
  postId: string | null;
};

export type RecordsPage = {
  range: StatRange;
  leaderboard: LeaderRow[];
  group: {
    wins: number;
    losses: number;
    pushes: number;
    open: number;
    people: GroupRow[];
  };
  superlatives: Superlative[];
};

const signedOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const units = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}u`;

function mini(results: { result: BetResult; weight: number }[]): MiniRecord {
  const rec = { wins: 0, losses: 0, pushes: 0 };
  results.forEach(({ result, weight }) => {
    if (result === 'WON') rec.wins += weight;
    else if (result === 'LOST') rec.losses += weight;
    else if (result === 'PUSH') rec.pushes += weight;
  });
  return rec;
}

/** Fading flips the result: the poster losing is a fade win */
const FADE_SIDE: Partial<Record<BetResult, BetResult>> = {
  WON: 'LOST',
  LOST: 'WON',
  PUSH: 'PUSH',
};

export function leaderRow(
  person: PersonRef,
  all: RecordBet[],
  since: Date | null
): LeaderRow {
  const bets = all.filter((b) => !since || b.createdAt >= since);
  return {
    ...person,
    line: statLine(bets),
    l5: lastResults(all, 5),
    streak: currentStreak(all),
    bestStreak: bestWinStreak(bets),
    faded: mini(
      bets
        .filter((b) => b.fades > 0 && FADE_SIDE[b.result])
        .map((b) => ({ result: FADE_SIDE[b.result]!, weight: b.fades }))
    ),
  };
}

export function groupRow(
  person: PersonRef,
  parlays: RecordGroupParlay[]
): GroupRow {
  const mine = parlays.filter((p) =>
    p.legs.some((l) => l.addedById === person.id)
  );
  const legs = mine
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .flatMap((p) => p.legs.filter((l) => l.addedById === person.id));
  return {
    ...person,
    parlays: mine.length,
    hit: legs.filter((l) => l.result === 'WON').length,
    busted: legs.filter((l) => l.result === 'LOST').length,
    pending: legs.filter((l) => l.result === 'PENDING').length,
    onlyMiss: mine.filter((p) => {
      const lost = p.legs.filter((l) => l.result === 'LOST');
      return (
        p.result === 'LOST' &&
        lost.length === 1 &&
        lost[0].addedById === person.id
      );
    }).length,
    cashed: mine.filter((p) => p.result === 'WON').length,
    l5: legs
      .map((l) => l.result)
      .filter((r): r is 'WON' | 'LOST' => r === 'WON' || r === 'LOST')
      .slice(0, 5),
  };
}

/** The headline cards; each only appears once someone qualifies */
export function superlatives(
  people: PersonRef[],
  bets: RecordBet[],
  groupRows: GroupRow[]
): Superlative[] {
  const who = new Map(people.map((p) => [p.id, p]));
  const out: Superlative[] = [];
  const push = (s: Omit<Superlative, 'person'>, personId: string) => {
    const person = who.get(personId);
    if (person) out.push({ ...s, person });
  };

  const wins = bets.filter((b) => b.result === 'WON');
  const biggest = wins.reduce<RecordBet | null>(
    (best, b) => (!best || b.americanOdds > best.americanOdds ? b : best),
    null
  );
  if (biggest) {
    push(
      {
        key: 'biggest',
        title: 'Biggest hit',
        value: signedOdds(biggest.americanOdds),
        detail: `$10 paid $${Math.round(10 * biggest.decimalOdds)}`,
        postId: biggest.postId,
      },
      biggest.authorId
    );
  }

  // A parlay of 3+ legs that lost on exactly one; longest price wins
  const beats = bets.filter(
    (b) =>
      b.result === 'LOST' &&
      b.legs.length >= 3 &&
      b.legs.filter((l) => l === 'LOST').length === 1
  );
  const worst = beats.reduce<RecordBet | null>(
    (best, b) => (!best || b.americanOdds > best.americanOdds ? b : best),
    null
  );
  if (worst) {
    push(
      {
        key: 'worstBeat',
        title: 'Worst beat',
        value: signedOdds(worst.americanOdds),
        detail: `${worst.legs.length - 1}/${worst.legs.length} legs hit`,
        postId: worst.postId,
      },
      worst.authorId
    );
  }

  const byAuthor = new Map<string, RecordBet[]>();
  bets.forEach((b) =>
    byAuthor.set(b.authorId, [...(byAuthor.get(b.authorId) ?? []), b])
  );

  const authors = [...byAuthor.entries()];
  const top = <T extends { n: number }>(xs: T[]) =>
    xs.reduce<T | null>((best, x) => (!best || x.n > best.n ? x : best), null);

  const streak = top(
    authors
      .map(([id, mine]) => ({ id, n: bestWinStreak(mine) }))
      .filter((x) => x.n >= 2)
  );
  if (streak) {
    const { id, n } = streak;
    push(
      {
        key: 'streak',
        title: 'Longest streak',
        value: `W${n}`,
        detail: 'Wins in a row',
        postId: null,
      },
      id
    );
  }

  // Net units per person per Central day
  const bestDay = top(
    authors.flatMap(([id, mine]) => {
      const days = new Map<string, number>();
      mine.forEach((b) => {
        const day = siteDayKey(b.createdAt);
        days.set(day, (days.get(day) ?? 0) + betNet(b));
      });
      return [...days].map(([day, net]) => ({
        id,
        day,
        n: Math.round(net * 100) / 100,
      }));
    })
  );
  if (bestDay && bestDay.n > 0) {
    const { id, day, n: net } = bestDay;
    const [y, m, d] = day.split('-').map(Number);
    const label = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', timeZone: 'UTC' }
    );
    push(
      {
        key: 'bestDay',
        title: 'Best day',
        value: units(net),
        detail: label,
        postId: null,
      },
      id
    );
  }

  const tailed = top(
    authors.map(([id, mine]) => {
      // A ladder tail lands on every rung; count each slip once
      const perSlip = new Map<string, number>();
      mine.forEach((b) =>
        perSlip.set(b.postId, Math.max(perSlip.get(b.postId) ?? 0, b.tails))
      );
      return { id, n: [...perSlip.values()].reduce((sum, t) => sum + t, 0) };
    })
  );
  if (tailed && tailed.n > 0) {
    const { id, n } = tailed;
    push(
      {
        key: 'mostTailed',
        title: 'Most tailed',
        value: `${n}`,
        detail: n === 1 ? 'tail' : 'tails',
        postId: null,
      },
      id
    );
  }

  const legKing = groupRows
    .filter((r) => r.hit > 0)
    .sort((a, b) => b.hit - a.hit || a.busted - b.busted)[0];
  if (legKing) {
    push(
      {
        key: 'legs',
        title: 'Group parlay MVP',
        value: `${legKing.hit}`,
        detail: `legs hit, ${legKing.busted} busted`,
        postId: null,
      },
      legKing.id
    );
  }

  return out;
}

/** The whole page from every bet; everything but L5 / streak uses `since` */
export function recordsPage(
  range: StatRange,
  since: Date | null,
  people: PersonRef[],
  bets: RecordBet[],
  groupParlays: RecordGroupParlay[]
): RecordsPage {
  const inRange = <T extends { createdAt: Date }>(xs: T[]) =>
    xs.filter((x) => !since || x.createdAt >= since);
  const groups = inRange(groupParlays);
  const groupRows = people
    .map((p) => groupRow(p, groups))
    .filter((r) => r.parlays > 0)
    .sort(
      (a, b) =>
        b.hit - a.hit ||
        a.busted - b.busted ||
        a.fullName.localeCompare(b.fullName)
    );
  const results = groups.map((g) => g.result);
  return {
    range,
    leaderboard: people
      .map((p) =>
        leaderRow(
          p,
          bets.filter((b) => b.authorId === p.id),
          since
        )
      )
      .sort((a, b) => b.line.net - a.line.net),
    group: {
      wins: results.filter((r) => r === 'WON').length,
      losses: results.filter((r) => r === 'LOST').length,
      pushes: results.filter((r) => r === 'PUSH').length,
      open: results.filter((r) => r === 'PENDING').length,
      people: groupRows,
    },
    superlatives: superlatives(people, inRange(bets), groupRows),
  };
}
