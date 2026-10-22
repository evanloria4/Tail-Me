// Fake friends + slips so the feed has something to look at during UI work.
//   npm run db:demo            (re)create demo users, posts and tails
//   npm run db:demo -- --clear remove them
// Safe to re-run: demo users are fixed ids, and their posts are replaced each time.
import prisma from '../src/server/db';
import {
  americanToDecimal,
  decimalToAmerican,
  parlayDecimal,
} from '../src/shared/odds';
import { betResultFromLegs } from '../src/shared/grading';

type Result = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'VOID';
type GradedBy = 'AUTO' | 'MANUAL';

type Leg = {
  sportKey: string;
  eventLabel: string;
  marketKey: string;
  marketLabel?: string;
  playerName?: string;
  selection: string;
  line?: number;
  americanOdds: number;
  /** Per-leg grade (parlays); straights and rungs follow their bet */
  result?: Result;
  /** Graded prop's stat, shown as "Final 278" */
  actual?: number;
  /** FanDuel add-to-betslip link, so Tail's "Add" buttons show */
  deepLink?: string;
};

type DemoPost = {
  author: string;
  book: string;
  minutesAgo: number;
  caption?: string;
  /** Who graded it; settled slips default to the auto-grader */
  gradedBy?: GradedBy;
} & (
  | { type: 'STRAIGHT'; units: number; leg: Leg; result?: Result }
  | {
      type: 'PARLAY';
      units: number;
      legs: Leg[];
      slipOdds?: number;
      result?: Result;
    }
  | {
      type: 'LADDER';
      pick: Omit<Leg, 'line' | 'americanOdds'>;
      rungs: {
        line: number;
        americanOdds: number;
        units: number;
        result?: Result;
        actual?: number;
        deepLink?: string;
      }[];
    }
);

const USERS = [
  {
    id: 'd3a0f6c1-0000-4000-8000-000000000001',
    username: 'mikeylocks',
    fullName: 'Mike Russo',
  },
  {
    id: 'd3a0f6c1-0000-4000-8000-000000000002',
    username: 'jpace',
    fullName: 'Jordan Pace',
  },
  {
    id: 'd3a0f6c1-0000-4000-8000-000000000003',
    username: 'tonyparlays',
    fullName: 'Tony Alvarez',
  },
  {
    id: 'd3a0f6c1-0000-4000-8000-000000000004',
    username: 'nickfades',
    fullName: 'Nick Fadden',
  },
];

/** Stand-in FanDuel add-to-betslip link (not a real selection) */
const fdLink = (id: number) =>
  `https://sportsbook.fanduel.com/addToBetslip?marketId=42.0&selectionId=${id}`;

const NFL = 'americanfootball_nfl';
const NCAAF = 'americanfootball_ncaaf';
const NHL = 'icehockey_nhl';

const POSTS: DemoPost[] = [
  {
    author: 'mikeylocks',
    book: 'fanduel',
    minutesAgo: 18,
    type: 'STRAIGHT',
    units: 2,
    caption: 'Bills at home in the cold. Lock it in.',
    leg: {
      sportKey: NFL,
      eventLabel: 'Chiefs @ Bills',
      marketKey: 'spreads',
      selection: 'Buffalo Bills',
      line: -3.5,
      americanOdds: -110,
      deepLink: fdLink(101),
    },
  },
  {
    author: 'jpace',
    book: 'espnbet',
    minutesAgo: 35,
    type: 'LADDER',
    caption: 'McDavid ladder, he is due.',
    pick: {
      sportKey: NHL,
      eventLabel: 'Oilers @ Flames',
      marketKey: 'player_prop',
      marketLabel: 'Points',
      playerName: 'Connor McDavid',
      selection: 'Over',
    },
    rungs: [
      { line: 0.5, americanOdds: -250, units: 1 },
      { line: 1.5, americanOdds: 130, units: 0.5 },
      { line: 2.5, americanOdds: 400, units: 0.25 },
    ],
  },
  {
    author: 'tonyparlays',
    book: 'draftkings',
    minutesAgo: 70,
    type: 'PARLAY',
    units: 1,
    caption: 'Sunday 3-legger',
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Packers @ Lions',
        marketKey: 'h2h',
        selection: 'Detroit Lions',
        americanOdds: -150,
      },
      {
        sportKey: NFL,
        eventLabel: 'Giants @ Eagles',
        marketKey: 'spreads',
        selection: 'Philadelphia Eagles',
        line: -6.5,
        americanOdds: -110,
      },
      {
        sportKey: NFL,
        eventLabel: 'Bengals @ Ravens',
        marketKey: 'totals',
        selection: 'Over',
        line: 47.5,
        americanOdds: -105,
      },
    ],
  },
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 190,
    type: 'PARLAY',
    units: 0.5,
    caption: 'SGP, FanDuel price is way better than multiplied',
    slipOdds: 450,
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Chiefs @ Bills',
        marketKey: 'player_prop',
        marketLabel: 'Passing Yards',
        playerName: 'Patrick Mahomes',
        selection: 'Over',
        line: 249.5,
        americanOdds: -115,
      },
      {
        sportKey: NFL,
        eventLabel: 'Chiefs @ Bills',
        marketKey: 'player_prop',
        marketLabel: 'Anytime TD',
        playerName: 'Travis Kelce',
        selection: 'Yes',
        americanOdds: 120,
      },
      {
        sportKey: NFL,
        eventLabel: 'Chiefs @ Bills',
        marketKey: 'h2h',
        selection: 'Kansas City Chiefs',
        americanOdds: 130,
      },
    ],
  },
  {
    author: 'mikeylocks',
    book: 'betmgm',
    minutesAgo: 300,
    type: 'STRAIGHT',
    units: 1,
    result: 'PUSH',
    leg: {
      sportKey: NHL,
      eventLabel: 'Rangers @ Bruins',
      marketKey: 'totals',
      selection: 'Under',
      line: 6,
      americanOdds: -120,
    },
  },
  {
    author: 'jpace',
    book: 'fanduel',
    minutesAgo: 60 * 26,
    type: 'LADDER',
    caption: 'Josh Allen TD ladder cashed two of three 💰',
    pick: {
      sportKey: NFL,
      eventLabel: 'Dolphins @ Bills',
      marketKey: 'player_prop',
      marketLabel: 'Passing TDs',
      playerName: 'Josh Allen',
      selection: 'Over',
    },
    rungs: [
      { line: 1.5, americanOdds: -150, units: 1, result: 'WON', actual: 3 },
      { line: 2.5, americanOdds: 190, units: 0.5, result: 'WON', actual: 3 },
      { line: 3.5, americanOdds: 550, units: 0.25, result: 'LOST', actual: 3 },
    ],
  },
  {
    author: 'mikeylocks',
    book: 'williamhill_us',
    minutesAgo: 60 * 50,
    type: 'STRAIGHT',
    units: 1,
    result: 'LOST',
    caption: 'Upset special. Michigan in Columbus.',
    leg: {
      sportKey: NCAAF,
      eventLabel: 'Michigan @ Ohio State',
      marketKey: 'h2h',
      selection: 'Michigan Wolverines',
      americanOdds: 145,
    },
  },
  // Older settled slips: Tony's 4-win heater (capped by a +650 parlay), a
  // clean ladder sweep, and a spread of green and red days for the calendar
  {
    author: 'nickfades',
    book: 'draftkings',
    minutesAgo: 60 * 24 * 3,
    type: 'STRAIGHT',
    units: 2,
    result: 'LOST',
    caption: 'Fading the public again.',
    leg: {
      sportKey: NFL,
      eventLabel: 'Cowboys @ Eagles',
      marketKey: 'spreads',
      selection: 'Dallas Cowboys',
      line: 6.5,
      americanOdds: -110,
    },
  },
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 60 * 24 * 4,
    type: 'PARLAY',
    units: 0.5,
    result: 'WON',
    caption: 'Told you. Pay the man.',
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Ravens @ Steelers',
        marketKey: 'h2h',
        selection: 'Pittsburgh Steelers',
        americanOdds: 130,
      },
      {
        sportKey: NFL,
        eventLabel: 'Packers @ Bears',
        marketKey: 'spreads',
        selection: 'Chicago Bears',
        line: 3.5,
        americanOdds: -110,
      },
      {
        sportKey: NFL,
        eventLabel: 'Jets @ Dolphins',
        marketKey: 'totals',
        selection: 'Under',
        line: 44.5,
        americanOdds: -105,
      },
    ],
  },
  {
    author: 'jpace',
    book: 'fanduel',
    minutesAgo: 60 * 24 * 5,
    type: 'LADDER',
    caption: 'Ladder szn. Every rung.',
    pick: {
      sportKey: NHL,
      eventLabel: 'Bruins @ Maple Leafs',
      marketKey: 'player_prop',
      marketLabel: 'Shots on Goal',
      playerName: 'Auston Matthews',
      selection: 'Over',
    },
    rungs: [
      { line: 3.5, americanOdds: -140, units: 1, result: 'WON', actual: 6 },
      { line: 4.5, americanOdds: 160, units: 0.5, result: 'WON', actual: 6 },
      { line: 5.5, americanOdds: 320, units: 0.25, result: 'WON', actual: 6 },
    ],
  },
  {
    author: 'tonyparlays',
    book: 'draftkings',
    minutesAgo: 60 * 24 * 6,
    type: 'STRAIGHT',
    units: 1,
    result: 'WON',
    leg: {
      sportKey: NHL,
      eventLabel: 'Rangers @ Devils',
      marketKey: 'h2h',
      selection: 'New York Rangers',
      americanOdds: 105,
    },
  },
  {
    author: 'nickfades',
    book: 'betmgm',
    minutesAgo: 60 * 24 * 7,
    type: 'STRAIGHT',
    units: 3,
    result: 'LOST',
    leg: {
      sportKey: NCAAF,
      eventLabel: 'Texas @ Oklahoma',
      marketKey: 'totals',
      selection: 'Over',
      line: 58.5,
      americanOdds: -110,
    },
  },
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 60 * 24 * 8,
    type: 'STRAIGHT',
    units: 1,
    result: 'WON',
    leg: {
      sportKey: NFL,
      eventLabel: 'Lions @ Vikings',
      marketKey: 'spreads',
      selection: 'Detroit Lions',
      line: -2.5,
      americanOdds: -115,
    },
  },
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 60 * 24 * 9,
    type: 'STRAIGHT',
    units: 1,
    result: 'WON',
    leg: {
      sportKey: NCAAF,
      eventLabel: 'Georgia @ Alabama',
      marketKey: 'h2h',
      selection: 'Georgia Bulldogs',
      americanOdds: -125,
    },
  },

  // ---------- Auto-grading situations ----------

  // Parlay half done: the early game cashed, the late one is still going
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 240,
    type: 'PARLAY',
    units: 1,
    caption: 'Early game cashed. Sweating the late one.',
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Titans @ Jaguars',
        marketKey: 'spreads',
        selection: 'Jacksonville Jaguars',
        line: 2.5,
        americanOdds: -110,
        result: 'WON',
        deepLink: fdLink(201),
      },
      {
        sportKey: NFL,
        eventLabel: 'Chiefs @ Raiders',
        marketKey: 'totals',
        selection: 'Over',
        line: 47.5,
        americanOdds: -105,
        deepLink: fdLink(202),
      },
    ],
  },
  // Parlay busted by exactly one leg (red dot shows whose)
  {
    author: 'nickfades',
    book: 'fanduel',
    minutesAgo: 60 * 30,
    type: 'PARLAY',
    units: 1,
    caption: 'One leg. ONE LEG.',
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Browns @ Bengals',
        marketKey: 'h2h',
        selection: 'Cincinnati Bengals',
        americanOdds: -180,
        result: 'WON',
      },
      {
        sportKey: NFL,
        eventLabel: 'Chargers @ Broncos',
        marketKey: 'spreads',
        selection: 'Los Angeles Chargers',
        line: -3,
        americanOdds: -110,
        result: 'LOST',
      },
      {
        sportKey: NFL,
        eventLabel: 'Saints @ Falcons',
        marketKey: 'totals',
        selection: 'Over',
        line: 41.5,
        americanOdds: -110,
        result: 'WON',
      },
    ],
  },
  // Parlay saved by a push: the pushed leg drops out
  {
    author: 'mikeylocks',
    book: 'fanduel',
    minutesAgo: 60 * 20,
    type: 'PARLAY',
    units: 1,
    caption: 'Push on the Texans and it still cashed',
    legs: [
      {
        sportKey: NFL,
        eventLabel: 'Rams @ Cardinals',
        marketKey: 'h2h',
        selection: 'Los Angeles Rams',
        americanOdds: -140,
        result: 'WON',
      },
      {
        sportKey: NFL,
        eventLabel: 'Texans @ Colts',
        marketKey: 'spreads',
        selection: 'Houston Texans',
        line: 3,
        americanOdds: -110,
        result: 'PUSH',
      },
      {
        sportKey: NHL,
        eventLabel: 'Stars @ Avalanche',
        marketKey: 'totals',
        selection: 'Over',
        line: 6.5,
        americanOdds: 105,
        result: 'WON',
      },
    ],
  },
  // Postponed game: voided, money back
  {
    author: 'jpace',
    book: 'fanduel',
    minutesAgo: 60 * 40,
    type: 'STRAIGHT',
    units: 1,
    result: 'VOID',
    caption: 'Game got postponed. Of course.',
    leg: {
      sportKey: NHL,
      eventLabel: 'Canucks @ Kraken',
      marketKey: 'h2h',
      selection: 'Vancouver Canucks',
      americanOdds: 115,
    },
  },
  // Graded prop showing its final stat
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 60 * 28,
    type: 'STRAIGHT',
    units: 1.5,
    result: 'WON',
    caption: 'Chase eats every week',
    leg: {
      sportKey: NFL,
      eventLabel: 'Bengals @ Steelers',
      marketKey: 'player_prop',
      marketLabel: 'Receiving Yards',
      playerName: "Ja'Marr Chase",
      selection: 'Over',
      line: 74.5,
      americanOdds: -115,
      actual: 112,
    },
  },
  // Long-odds winner: gold "cashed" treatment
  {
    author: 'mikeylocks',
    book: 'fanduel',
    minutesAgo: 60 * 22,
    type: 'STRAIGHT',
    units: 0.5,
    result: 'WON',
    caption: 'Caufield anytime at +420. Two of them.',
    leg: {
      sportKey: NHL,
      eventLabel: 'Canadiens @ Senators',
      marketKey: 'player_prop',
      marketLabel: 'Anytime Goal',
      playerName: 'Cole Caufield',
      selection: 'Yes',
      americanOdds: 420,
      actual: 2,
    },
  },
  // Prop the poster graded by hand (⋯ → Change result)
  {
    author: 'nickfades',
    book: 'fanduel',
    minutesAgo: 60 * 33,
    type: 'STRAIGHT',
    units: 1,
    result: 'LOST',
    gradedBy: 'MANUAL',
    caption: 'Saquon under 90. Never again.',
    leg: {
      sportKey: NFL,
      eventLabel: 'Eagles @ Giants',
      marketKey: 'player_prop',
      marketLabel: 'Rushing Yards',
      playerName: 'Saquon Barkley',
      selection: 'Over',
      line: 89.5,
      americanOdds: -120,
      actual: 61,
    },
  },
  // 8 legs: shows 5 and a "View all 8 legs" row
  {
    author: 'jpace',
    book: 'fanduel',
    minutesAgo: 8,
    type: 'PARLAY',
    units: 0.5,
    caption: 'Eight-leg Sunday special',
    legs: [
      ['Giants @ Eagles', 'h2h', 'Philadelphia Eagles', undefined, -210],
      ['Chiefs @ Raiders', 'spreads', 'Kansas City Chiefs', -6.5, -110],
      ['Bengals @ Ravens', 'totals', 'Over', 47.5, -105],
      ['Seahawks @ 49ers', 'h2h', 'San Francisco 49ers', undefined, -145],
      ['Kings @ Ducks', 'totals', 'Over', 5.5, -120],
      ['Ravens @ Bills', 'spreads', 'Buffalo Bills', -2.5, -115],
      ['Packers @ Lions', 'totals', 'Over', 49.5, -110],
      ['Oilers @ Flames', 'h2h', 'Edmonton Oilers', undefined, -135],
    ].map(([eventLabel, marketKey, selection, line, americanOdds], i) => ({
      sportKey: ['Kings @ Ducks', 'Oilers @ Flames'].includes(
        eventLabel as string
      )
        ? NHL
        : NFL,
      eventLabel: eventLabel as string,
      marketKey: marketKey as string,
      selection: selection as string,
      line: line as number | undefined,
      americanOdds: americanOdds as number,
      deepLink: fdLink(500 + i),
    })),
  },
  // Long parlay: shows 5 legs and a "View all 7 legs" row
  {
    author: 'tonyparlays',
    book: 'fanduel',
    minutesAgo: 15,
    type: 'PARLAY',
    units: 0.25,
    caption: 'Seven-leg lottery ticket. Don’t judge me.',
    legs: [
      ['Packers @ Lions', 'h2h', 'Detroit Lions', undefined, -150],
      ['Giants @ Eagles', 'spreads', 'Philadelphia Eagles', -6.5, -110],
      ['Bengals @ Ravens', 'totals', 'Over', 47.5, -105],
      ['Chiefs @ Raiders', 'h2h', 'Kansas City Chiefs', undefined, -240],
      ['Seahawks @ 49ers', 'spreads', 'San Francisco 49ers', -3, -110],
      ['Kings @ Ducks', 'h2h', 'Los Angeles Kings', undefined, -160],
      ['Ravens @ Bills', 'totals', 'Under', 51.5, -110],
    ].map(([eventLabel, marketKey, selection, line, americanOdds], i) => ({
      sportKey: eventLabel === 'Kings @ Ducks' ? NHL : NFL,
      eventLabel: eventLabel as string,
      marketKey: marketKey as string,
      selection: selection as string,
      line: line as number | undefined,
      americanOdds: americanOdds as number,
      deepLink: fdLink(400 + i),
    })),
  },
  // Pending ladder with live links (Tail lists one Add per rung)
  {
    author: 'jpace',
    book: 'fanduel',
    minutesAgo: 50,
    type: 'LADDER',
    caption: 'Lamar rushing ladder for SNF',
    pick: {
      sportKey: NFL,
      eventLabel: 'Ravens @ Bills',
      marketKey: 'player_prop',
      marketLabel: 'Rushing Yards',
      playerName: 'Lamar Jackson',
      selection: 'Over',
    },
    rungs: [
      { line: 49.5, americanOdds: -150, units: 1, deepLink: fdLink(301) },
      { line: 74.5, americanOdds: 175, units: 0.5, deepLink: fdLink(302) },
      { line: 99.5, americanOdds: 450, units: 0.25, deepLink: fdLink(303) },
    ],
  },
];

/** Comments + reactions by post index in POSTS: [username, text] */
const COMMENTS: Record<number, [string, string][]> = {
  0: [
    ['jpace', 'Bills in the snow is free money'],
    ['tonyparlays', 'Fading. Dolphins cover easy'],
    ['mikeylocks', 'We’ll see who’s laughing Sunday'],
  ],
  8: [
    ['mikeylocks', 'Tony is cooking right now'],
    ['nickfades', 'Lucky. Under hit by half a point'],
  ],
  9: [['tonyparlays', 'Matthews never misses at home']],
};
const REACTIONS: Record<number, [string, string][]> = {
  0: [
    ['jpace', '🔒'],
    ['tonyparlays', '🤡'],
    ['nickfades', '🔒'],
  ],
  8: [
    ['mikeylocks', '💰'],
    ['jpace', '💰'],
    ['nickfades', '😬'],
    ['jpace', '🔥'],
  ],
  9: [['tonyparlays', '🔥']],
};

/** Graded rows record who graded them; pending ones have no grader */
const grader = (result: Result, by: GradedBy = 'AUTO') =>
  result === 'PENDING' ? null : by;

/**
 * Games the open demo slips are tied to, so LIVE / PENDING tags show:
 * started minutes ago (negative = later today), and whether it's final.
 * Short team names never match ESPN, so the grader leaves these alone.
 */
const DEMO_GAMES: Record<
  string,
  { startedMinutesAgo: number; final?: boolean }
> = {
  // Live now
  'Chiefs @ Bills': { startedMinutesAgo: 70 },
  'Chiefs @ Raiders': { startedMinutesAgo: 95 },
  'Ravens @ Bills': { startedMinutesAgo: 40 },
  'Giants @ Eagles': { startedMinutesAgo: 110 },
  'Kings @ Ducks': { startedMinutesAgo: 30 },
  // Over, but the grade isn't in yet ("PENDING")
  'Packers @ Lions': { startedMinutesAgo: 220, final: true },
  'Titans @ Jaguars': { startedMinutesAgo: 260, final: true },
  // Later today: no tag
  'Bengals @ Ravens': { startedMinutesAgo: -180 },
  'Oilers @ Flames': { startedMinutesAgo: -240 },
  'Seahawks @ 49ers': { startedMinutesAgo: -150 },
};
const demoEventId = (label: string) =>
  DEMO_GAMES[label]
    ? `demo-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    : null;

async function seedDemoGames(now: number) {
  await prisma.event.deleteMany({ where: { id: { startsWith: 'demo-' } } });
  await prisma.event.createMany({
    data: Object.entries(DEMO_GAMES).map(([label, g]) => {
      const [awayTeam, homeTeam] = label.split(' @ ');
      const nhl = ['Kings', 'Oilers'].includes(awayTeam);
      return {
        id: demoEventId(label)!,
        sportKey: nhl ? NHL : NFL,
        homeTeam,
        awayTeam,
        commenceTime: new Date(now - g.startedMinutesAgo * 60_000),
        completed: !!g.final,
      };
    }),
  });
}

function legData(leg: Leg, order: number, by?: GradedBy) {
  const result = leg.result ?? 'PENDING';
  return {
    order,
    sportKey: leg.sportKey,
    eventId: demoEventId(leg.eventLabel),
    eventLabel: leg.eventLabel,
    marketKey: leg.marketKey,
    marketLabel: leg.marketLabel ?? null,
    playerName: leg.playerName ?? null,
    selection: leg.selection,
    line: leg.line ?? null,
    americanOdds: leg.americanOdds,
    result,
    gradedBy: grader(result, by),
    actual: leg.actual ?? null,
    deepLink: leg.deepLink ?? null,
  };
}

function betRow(result: Result, now: number, by?: GradedBy) {
  return {
    result,
    gradedBy: grader(result, by),
    settledAt: result === 'PENDING' ? null : new Date(now),
  };
}

function betsData(post: DemoPost, now: number) {
  const by = post.gradedBy;
  if (post.type === 'STRAIGHT') {
    const result = post.result ?? 'PENDING';
    return [
      {
        order: 0,
        units: post.units,
        americanOdds: post.leg.americanOdds,
        decimalOdds: americanToDecimal(post.leg.americanOdds),
        deepLink: post.leg.deepLink ?? null,
        ...betRow(result, now, by),
        legs: { create: [legData({ ...post.leg, result }, 0, by)] },
      },
    ];
  }
  if (post.type === 'PARLAY') {
    const decimal = post.slipOdds
      ? americanToDecimal(post.slipOdds)
      : parlayDecimal(post.legs.map((l) => l.americanOdds));
    // A parlay marked won without per-leg grades won every leg
    const legs = post.legs.map((l) => ({
      ...l,
      result: l.result ?? (post.result === 'WON' ? 'WON' : undefined),
    }));
    const result =
      post.result ?? betResultFromLegs(legs.map((l) => l.result ?? 'PENDING'));
    return [
      {
        order: 0,
        units: post.units,
        americanOdds: post.slipOdds ?? decimalToAmerican(decimal),
        decimalOdds: decimal,
        ...betRow(result, now, by),
        legs: { create: legs.map((l, i) => legData(l, i, by)) },
      },
    ];
  }
  return post.rungs.map((rung, i) => {
    const result = rung.result ?? 'PENDING';
    return {
      order: i,
      units: rung.units,
      americanOdds: rung.americanOdds,
      decimalOdds: americanToDecimal(rung.americanOdds),
      deepLink: rung.deepLink ?? null,
      ...betRow(result, now, by),
      legs: { create: [legData({ ...post.pick, ...rung, result }, 0, by)] },
    };
  });
}

const userIds = USERS.map((u) => u.id);

async function clear() {
  // Posts, bets, legs and tails cascade from the users
  const { count } = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  await prisma.event.deleteMany({ where: { id: { startsWith: 'demo-' } } });
  console.log(`Removed ${count} demo users and their posts`);
}

type GroupLeg = Leg & { by: string };

/**
 * Group parlays in every state: taking legs, locked and busted by one leg,
 * locked and partly graded, and a same-game one waiting on the book price.
 */
async function seedGroupParlays(
  sportsbookId: string,
  userId: Map<string, string>,
  now: number
) {
  const groups: {
    author: string;
    minutesAgo: number;
    lockInMinutes: number;
    locked?: boolean;
    /** "This game only" */
    groupEvent?: { id: string; label: string };
    caption: string;
    legs: GroupLeg[];
  }[] = [
    {
      author: 'tonyparlays',
      minutesAgo: 25,
      lockInMinutes: 60 * 5,
      caption: 'Sunday group parlay. One leg each, no cowards.',
      legs: [
        {
          by: 'tonyparlays',
          sportKey: NFL,
          eventLabel: 'Bengals @ Ravens',
          marketKey: 'h2h',
          selection: 'Baltimore Ravens',
          americanOdds: -150,
        },
        {
          by: 'jpace',
          sportKey: NFL,
          eventLabel: 'Seahawks @ 49ers',
          marketKey: 'totals',
          selection: 'Over',
          line: 45.5,
          americanOdds: -110,
        },
      ],
    },
    {
      author: 'mikeylocks',
      minutesAgo: 60 * 24 * 2,
      lockInMinutes: -60 * 24 * 2 + 60,
      locked: true,
      caption: 'Group parlay #1. Let’s eat.',
      legs: [
        {
          by: 'mikeylocks',
          result: 'WON',
          sportKey: NFL,
          eventLabel: 'Chiefs @ Raiders',
          marketKey: 'spreads',
          selection: 'Kansas City Chiefs',
          line: -6.5,
          americanOdds: -110,
        },
        {
          by: 'jpace',
          result: 'WON',
          sportKey: NHL,
          eventLabel: 'Oilers @ Flames',
          marketKey: 'h2h',
          selection: 'Edmonton Oilers',
          americanOdds: -130,
        },
        {
          by: 'nickfades',
          result: 'LOST',
          sportKey: NFL,
          eventLabel: 'Giants @ Commanders',
          marketKey: 'h2h',
          selection: 'New York Giants',
          americanOdds: 210,
        },
      ],
    },
    // Locked and partly graded: one game's done, two still going
    {
      author: 'jpace',
      minutesAgo: 60 * 5,
      lockInMinutes: -60 * 2,
      caption: 'Group parlay #2. Mike already cashed his leg.',
      legs: [
        {
          by: 'mikeylocks',
          result: 'WON',
          sportKey: NFL,
          eventLabel: 'Titans @ Jaguars',
          marketKey: 'h2h',
          selection: 'Jacksonville Jaguars',
          americanOdds: -135,
        },
        {
          by: 'jpace',
          sportKey: NFL,
          eventLabel: 'Chiefs @ Raiders',
          marketKey: 'totals',
          selection: 'Over',
          line: 47.5,
          americanOdds: -105,
        },
        {
          by: 'tonyparlays',
          sportKey: NHL,
          eventLabel: 'Kings @ Ducks',
          marketKey: 'h2h',
          selection: 'Los Angeles Kings',
          americanOdds: -160,
        },
      ],
    },
    // "This game only", locked, the multiplied price shown as "est." until
    // the creator enters FanDuel's same-game price
    {
      author: 'nickfades',
      minutesAgo: 90,
      lockInMinutes: -20,
      groupEvent: { id: 'demo-kc-buf', label: 'Chiefs @ Bills' },
      caption: 'Same-game group parlay for the late game',
      legs: [
        {
          by: 'nickfades',
          sportKey: NFL,
          eventLabel: 'Chiefs @ Bills',
          marketKey: 'h2h',
          selection: 'Buffalo Bills',
          americanOdds: -125,
        },
        {
          by: 'mikeylocks',
          sportKey: NFL,
          eventLabel: 'Chiefs @ Bills',
          marketKey: 'player_prop',
          marketLabel: 'Passing Yards',
          playerName: 'Josh Allen',
          selection: 'Over',
          line: 244.5,
          americanOdds: -115,
        },
        {
          by: 'tonyparlays',
          sportKey: NFL,
          eventLabel: 'Chiefs @ Bills',
          marketKey: 'player_prop',
          marketLabel: 'Anytime TD',
          playerName: 'James Cook',
          selection: 'Yes',
          americanOdds: -105,
        },
      ],
    },
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const g of groups) {
    const decimal = parlayDecimal(g.legs.map((l) => l.americanOdds));
    // Same rule the grader uses: any loss sinks it, any open leg keeps it open
    const result = betResultFromLegs(g.legs.map((l) => l.result ?? 'PENDING'));
    const createdAt = new Date(now - g.minutesAgo * 60_000);
    // eslint-disable-next-line no-await-in-loop
    await prisma.post.create({
      data: {
        authorId: userId.get(g.author)!,
        type: 'GROUP_PARLAY',
        caption: g.caption,
        sportsbookId,
        createdAt,
        lockAt: new Date(now + g.lockInMinutes * 60_000),
        lockedAt: g.locked ? new Date(createdAt.getTime() + 60 * 60_000) : null,
        groupEventId: g.groupEvent?.id ?? null,
        groupEventLabel: g.groupEvent?.label ?? null,
        bets: {
          create: [
            {
              order: 0,
              units: 1,
              americanOdds: decimalToAmerican(decimal),
              decimalOdds: decimal,
              ...betRow(result, now),
              legs: {
                create: g.legs.map(({ by, ...leg }, i) => ({
                  ...legData(leg, i),
                  addedById: userId.get(by)!,
                })),
              },
            },
          ],
        },
      },
    });
  }
  return groups.length;
}

async function main() {
  if (process.argv.includes('--clear')) {
    await clear();
    return;
  }

  const books = await prisma.sportsbook.findMany();
  const bookId = new Map(books.map((b) => [b.key, b.id]));
  if (!bookId.size) throw new Error('No sportsbooks; run `npm run db:seed`');

  await Promise.all(
    USERS.map((u) =>
      prisma.user.upsert({
        where: { id: u.id },
        update: { username: u.username, fullName: u.fullName },
        create: u,
      })
    )
  );
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
  await seedDemoGames(Date.now());

  const userId = new Map(USERS.map((u) => [u.username, u.id]));
  const now = Date.now();
  const created: { id: string; authorId: string; bets: { id: string }[] }[] =
    [];
  // Sequential so createdAt ordering and ids stay predictable
  // eslint-disable-next-line no-restricted-syntax
  for (const post of POSTS) {
    // eslint-disable-next-line no-await-in-loop
    const row = await prisma.post.create({
      data: {
        authorId: userId.get(post.author)!,
        type: post.type,
        caption: post.caption ?? null,
        sportsbookId: bookId.get(post.book)!,
        createdAt: new Date(now - post.minutesAgo * 60_000),
        bets: { create: betsData(post, now) },
      },
      include: { bets: true },
    });
    created.push(row);
  }

  // Friends tail each other's bets (never their own) so tail counts show up
  // (0, 1 or 2 tailers per post down the feed; the top slip gets everyone,
  // which makes it a Group lock)
  const tails = created.flatMap((post, i) =>
    post.bets.flatMap((bet) =>
      userIds
        .filter((id) => id !== post.authorId)
        .slice(0, i === 0 ? undefined : (i + 1) % 3)
        .map((id) => ({ userId: id, betId: bet.id }))
    )
  );
  await prisma.tail.createMany({ data: tails, skipDuplicates: true });

  const byIndex = <T>(
    rows: Record<number, [string, string][]>,
    make: (postId: string, userId: string, text: string, n: number) => T
  ) =>
    Object.entries(rows).flatMap(([i, list]) =>
      list.map(([username, text], n) =>
        make(created[Number(i)].id, userId.get(username)!, text, n)
      )
    );
  const comments = byIndex(COMMENTS, (postId, authorId, body, n) => ({
    postId,
    authorId,
    body,
    // A minute apart so the thread reads in order
    createdAt: new Date(now - (60 - n) * 60_000),
  }));
  await prisma.comment.createMany({ data: comments });
  const reactions = byIndex(REACTIONS, (postId, uid, emoji) => ({
    postId,
    userId: uid,
    emoji,
  }));
  await prisma.reaction.createMany({ data: reactions, skipDuplicates: true });

  const groups = await seedGroupParlays(bookId.get('fanduel')!, userId, now);

  // Jordan files every ladder under a series
  const jordan = userId.get('jpace')!;
  const series = await prisma.series.upsert({
    where: { ownerId_name: { ownerId: jordan, name: 'Ladder Szn' } },
    update: {},
    create: {
      ownerId: jordan,
      name: 'Ladder Szn',
      description: 'One prop, every rung. Posted every week.',
    },
  });
  const { count: inSeries } = await prisma.post.updateMany({
    where: { authorId: jordan, type: 'LADDER' },
    data: { seriesId: series.id },
  });

  console.log(
    `Seeded ${USERS.length} demo users, ${created.length} posts, ${groups} group parlays, 1 series (${inSeries} slips), ${tails.length} tails, ${comments.length} comments, ${reactions.length} reactions`
  );
}

main().finally(() => prisma.$disconnect());
