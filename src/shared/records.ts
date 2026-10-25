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

/**
 * A parlay that lost on exactly one leg (pushed or voided legs don't count
 * against it): the "so close" tally on profiles and Records, and worst
 * beats. Only once every leg is in: a parlay is lost the moment one leg
 * misses, but a leg still being played could miss too.
 */
export const isOneLegMiss = (result: BetResult, legs: BetResult[]) =>
  result === 'LOST' &&
  legs.length >= 2 &&
  !legs.includes('PENDING') &&
  legs.filter((l) => l === 'LOST').length === 1;

export type NearMisses = {
  count: number;
  /** What those parlays would have won, in the poster's units */
  units: number;
};

/** One-leg misses among personal bets, and the winnings they cost */
export function nearMisses(
  bets: {
    result: BetResult;
    legs: BetResult[];
    units: number;
    decimalOdds: number;
  }[]
): NearMisses {
  const missed = bets.filter((b) => isOneLegMiss(b.result, b.legs));
  const units = missed.reduce((s, b) => s + b.units * (b.decimalOdds - 1), 0);
  return { count: missed.length, units: Math.round(units * 100) / 100 };
}

/** Settled bets before someone ranks on win % / ROI */
export const MIN_RANKED = 10;

/** One personal bet with what the records need beyond profile stats */
export type RecordBet = StatBet & {
  authorId: string;
  postId: string;
  americanOdds: number;
  /** Distinct people who tailed it */
  tails: number;
  /** Who tailed it (one entry per person) */
  tailers: string[];
  /** People who faded the slip (straight bets only) */
  fades: number;
  /** Each leg's result (parlays; one entry otherwise) */
  legs: BetResult[];
  /** The series the slip is filed under, if any */
  seriesId: string | null;
};

/** A series as Records lists it: its cover, owner and record */
export type RecordSeries = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  ownerId: string;
};

export type SeriesRow = Omit<RecordSeries, 'ownerId'> & {
  owner: PersonRef;
  /** Slips filed under it in range */
  slips: number;
  line: StatLine;
  /** Last 5 settled bets, newest first; ignores the range like streaks */
  l5: SettledResult[];
  streak: Streak | null;
  bestStreak: number;
};

/** One group parlay: its result and who added which leg */
export type RecordGroupParlay = {
  postId: string;
  createdAt: Date;
  result: BetResult;
  decimalOdds: number;
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
  /** Parlays that lost on one leg, in range */
  nearMisses: NearMisses;
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
  key:
    | 'biggest'
    | 'worstBeat'
    | 'streak'
    | 'bestDay'
    | 'mostTailed'
    | 'bestToTail'
    | 'bestTailer'
    | 'sharpest'
    | 'longestParlay'
    | 'ladderKing'
    | 'mostActive'
    | 'soClose'
    | 'coldest'
    | 'worstDay'
    | 'fadeMaterial'
    | 'legs';
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
    /** Group parlays that lost on one leg, and what $10 on each would have paid */
    nearMisses: { count: number; paid: number };
  };
  /** Every user's series, best units first */
  series: SeriesRow[];
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
    nearMisses: nearMisses(bets),
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

const SUPERLATIVE_ORDER: Superlative['key'][] = [
  'biggest',
  'bestToTail',
  'bestTailer',
  'streak',
  'bestDay',
  'sharpest',
  'longestParlay',
  'ladderKing',
  'mostTailed',
  'legs',
  'mostActive',
  'worstBeat',
  'soClose',
  'coldest',
  'worstDay',
  'fadeMaterial',
];

/** "Oct 19" for a Central day key */
const dayLabel = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

/** Longest run of losses, oldest to newest (pushes don't break it) */
function worstLosingRun(bets: RecordBet[]): number {
  let worst = 0;
  let run = 0;
  lastResults(bets, Number.MAX_SAFE_INTEGER)
    .reverse()
    .forEach((r) => {
      if (r === 'PUSH') return;
      run = r === 'LOST' ? run + 1 : 0;
      worst = Math.max(worst, run);
    });
  return worst;
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
    (b) => b.legs.length >= 3 && isOneLegMiss(b.result, b.legs)
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

  // Units everyone who tailed them won, if each bet the poster's units
  const bestToTail = top(
    authors.map(([id, mine]) => ({
      id,
      n:
        Math.round(
          mine.reduce((sum, b) => sum + b.tails * betNet(b), 0) * 100
        ) / 100,
    }))
  );
  if (bestToTail && bestToTail.n > 0) {
    const { id, n } = bestToTail;
    push(
      {
        key: 'bestToTail',
        title: 'Best to tail',
        value: units(n),
        detail: 'made for tailers',
        postId: null,
      },
      id
    );
  }

  // Units each person made tailing others, at the poster's stake (real
  // stakes aren't known): every settled bet they tailed adds its net
  const tailing = new Map<string, number>();
  bets.forEach((b) =>
    b.tailers.forEach((id) =>
      tailing.set(id, (tailing.get(id) ?? 0) + betNet(b))
    )
  );
  const bestTailer = top(
    [...tailing].map(([id, n]) => ({ id, n: Math.round(n * 100) / 100 }))
  );
  if (bestTailer && bestTailer.n > 0) {
    const { id, n } = bestTailer;
    push(
      {
        key: 'bestTailer',
        title: 'Coat tailer',
        value: units(n),
        detail: 'made tailing others',
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

  // ---------- Records over enough bets ----------
  const lines = authors.map(([id, mine]) => ({ id, line: statLine(mine) }));
  const winRate = (l: StatLine) => l.wins / Math.max(1, l.wins + l.losses);
  const qualified = lines.filter(
    (x) => x.line.wins + x.line.losses + x.line.pushes >= MIN_RANKED
  );
  const pctText = (l: StatLine) => `${Math.round(winRate(l) * 100)}%`;

  const sharp = qualified.reduce<(typeof lines)[number] | null>(
    (best, x) => (!best || winRate(x.line) > winRate(best.line) ? x : best),
    null
  );
  if (sharp) {
    push(
      {
        key: 'sharpest',
        title: 'Sharpest',
        value: pctText(sharp.line),
        detail: `${sharp.line.wins}-${sharp.line.losses} record`,
        postId: null,
      },
      sharp.id
    );
  }

  const fade = qualified.reduce<(typeof lines)[number] | null>(
    (lo, x) => (!lo || winRate(x.line) < winRate(lo.line) ? x : lo),
    null
  );
  if (fade && winRate(fade.line) < 0.5) {
    push(
      {
        key: 'fadeMaterial',
        title: 'Fade material',
        value: pctText(fade.line),
        detail: `${fade.line.wins}-${fade.line.losses} record`,
        postId: null,
      },
      fade.id
    );
  }

  // ---------- Single-bet feats ----------
  const longParlay = bets
    .filter(
      (b) => b.type === 'PARLAY' && b.result === 'WON' && b.legs.length >= 3
    )
    .sort(
      (a, b) => b.legs.length - a.legs.length || b.americanOdds - a.americanOdds
    )[0];
  if (longParlay) {
    push(
      {
        key: 'longestParlay',
        title: 'Longest parlay hit',
        value: `${longParlay.legs.length} legs`,
        detail: `cashed at ${signedOdds(longParlay.americanOdds)}`,
        postId: longParlay.postId,
      },
      longParlay.authorId
    );
  }

  // A clean sweep: every rung of a 2+ rung ladder hit (voided rungs skipped)
  const ladders = new Map<string, RecordBet[]>();
  bets
    .filter((b) => b.type === 'LADDER')
    .forEach((b) =>
      ladders.set(b.postId, [...(ladders.get(b.postId) ?? []), b])
    );
  const sweeps = new Map<string, number>();
  ladders.forEach((rungs) => {
    const live = rungs.filter((r) => r.result !== 'VOID');
    if (live.length >= 2 && live.every((r) => r.result === 'WON')) {
      const { authorId } = rungs[0];
      sweeps.set(authorId, (sweeps.get(authorId) ?? 0) + 1);
    }
  });
  const sweepKing = top([...sweeps].map(([id, n]) => ({ id, n })));
  if (sweepKing) {
    push(
      {
        key: 'ladderKing',
        title: 'Ladder king',
        value: `${sweepKing.n}`,
        detail: sweepKing.n === 1 ? 'clean sweep' : 'clean sweeps',
        postId: null,
      },
      sweepKing.id
    );
  }

  // ---------- Volume and pain ----------
  const active = top(
    lines.map((x) => ({
      id: x.id,
      n: x.line.wins + x.line.losses + x.line.pushes,
    }))
  );
  if (active && active.n >= 5) {
    push(
      {
        key: 'mostActive',
        title: 'Most active',
        value: `${active.n}`,
        detail: 'bets settled',
        postId: null,
      },
      active.id
    );
  }

  const close = top(
    authors.map(([id, mine]) => ({ id, n: nearMisses(mine).count }))
  );
  if (close && close.n > 0) {
    push(
      {
        key: 'soClose',
        title: 'So close',
        value: `${close.n}`,
        detail:
          close.n === 1 ? 'parlay lost by one leg' : 'parlays lost by one leg',
        postId: null,
      },
      close.id
    );
  }

  const cold = top(
    authors.map(([id, mine]) => ({ id, n: worstLosingRun(mine) }))
  );
  if (cold && cold.n >= 3) {
    push(
      {
        key: 'coldest',
        title: 'Coldest streak',
        value: `L${cold.n}`,
        detail: 'losses in a row',
        postId: null,
      },
      cold.id
    );
  }

  const worstDay = authors
    .flatMap(([id, mine]) => {
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
    .reduce<{ id: string; day: string; n: number } | null>(
      (lo, x) => (!lo || x.n < lo.n ? x : lo),
      null
    );
  if (worstDay && worstDay.n < 0) {
    push(
      {
        key: 'worstDay',
        title: 'Worst day',
        value: units(worstDay.n),
        detail: dayLabel(worstDay.day),
        postId: null,
      },
      worstDay.id
    );
  }

  out.sort(
    (a, b) =>
      SUPERLATIVE_ORDER.indexOf(a.key) - SUPERLATIVE_ORDER.indexOf(b.key)
  );
  return out;
}

/** The whole page from every bet; everything but L5 / streak uses `since` */
export function recordsPage(
  range: StatRange,
  since: Date | null,
  people: PersonRef[],
  bets: RecordBet[],
  groupParlays: RecordGroupParlay[],
  allSeries: RecordSeries[] = []
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
  const owners = new Map(people.map((p) => [p.id, p]));
  const series = allSeries
    .flatMap((s): SeriesRow[] => {
      const owner = owners.get(s.ownerId);
      if (!owner) return [];
      const mine = bets.filter((b) => b.seriesId === s.id);
      const ranged = inRange(mine);
      const { ownerId, ...cover } = s;
      return [
        {
          ...cover,
          owner,
          slips: new Set(ranged.map((b) => b.postId)).size,
          line: statLine(ranged),
          l5: lastResults(mine, 5),
          streak: currentStreak(mine),
          bestStreak: bestWinStreak(ranged),
        },
      ];
    })
    .sort((a, b) => b.line.net - a.line.net);
  return {
    series,
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
      nearMisses: (() => {
        const missed = groups.filter((p) =>
          isOneLegMiss(
            p.result,
            p.legs.map((l) => l.result)
          )
        );
        return {
          count: missed.length,
          paid: Math.round(
            missed.reduce((sum, p) => sum + 10 * p.decimalOdds, 0)
          ),
        };
      })(),
    },
    superlatives: superlatives(people, inRange(bets), groupRows),
  };
}
