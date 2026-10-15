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

type Result = 'PENDING' | 'WON' | 'LOST' | 'PUSH' | 'VOID';

type Leg = {
  sportKey: string;
  eventLabel: string;
  marketKey: string;
  marketLabel?: string;
  playerName?: string;
  selection: string;
  line?: number;
  americanOdds: number;
};

type DemoPost = {
  author: string;
  book: string;
  minutesAgo: number;
  caption?: string;
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
];

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
      { line: 1.5, americanOdds: -150, units: 1, result: 'WON' },
      { line: 2.5, americanOdds: 190, units: 0.5, result: 'WON' },
      { line: 3.5, americanOdds: 550, units: 0.25, result: 'LOST' },
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
];

function legData(leg: Leg, order: number) {
  return {
    order,
    sportKey: leg.sportKey,
    eventLabel: leg.eventLabel,
    marketKey: leg.marketKey,
    marketLabel: leg.marketLabel ?? null,
    playerName: leg.playerName ?? null,
    selection: leg.selection,
    line: leg.line ?? null,
    americanOdds: leg.americanOdds,
  };
}

function betsData(post: DemoPost) {
  if (post.type === 'STRAIGHT') {
    return [
      {
        order: 0,
        units: post.units,
        americanOdds: post.leg.americanOdds,
        decimalOdds: americanToDecimal(post.leg.americanOdds),
        result: post.result ?? 'PENDING',
        legs: { create: [legData(post.leg, 0)] },
      },
    ];
  }
  if (post.type === 'PARLAY') {
    const decimal = post.slipOdds
      ? americanToDecimal(post.slipOdds)
      : parlayDecimal(post.legs.map((l) => l.americanOdds));
    return [
      {
        order: 0,
        units: post.units,
        americanOdds: post.slipOdds ?? decimalToAmerican(decimal),
        decimalOdds: decimal,
        result: post.result ?? 'PENDING',
        legs: { create: post.legs.map(legData) },
      },
    ];
  }
  return post.rungs.map((rung, i) => ({
    order: i,
    units: rung.units,
    americanOdds: rung.americanOdds,
    decimalOdds: americanToDecimal(rung.americanOdds),
    result: rung.result ?? 'PENDING',
    legs: { create: [legData({ ...post.pick, ...rung }, 0)] },
  }));
}

const userIds = USERS.map((u) => u.id);

async function clear() {
  // Posts, bets, legs and tails cascade from the users
  const { count } = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  console.log(`Removed ${count} demo users and their posts`);
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

  const userId = new Map(USERS.map((u) => [u.username, u.id]));
  const now = Date.now();
  const created = [];
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
        bets: { create: betsData(post) },
      },
      include: { bets: true },
    });
    created.push(row);
  }

  // Friends tail each other's bets (never their own) so tail counts show up
  // (0, 1 or 2 tailers per post, varying down the feed)
  const tails = created.flatMap((post, i) =>
    post.bets.flatMap((bet) =>
      userIds
        .filter((id) => id !== post.authorId)
        .slice(0, (i + 1) % 3)
        .map((id) => ({ userId: id, betId: bet.id }))
    )
  );
  await prisma.tail.createMany({ data: tails, skipDuplicates: true });

  console.log(
    `Seeded ${USERS.length} demo users, ${created.length} posts, ${tails.length} tails`
  );
}

main().finally(() => prisma.$disconnect());
