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
  {
    id: 'd3a0f6c1-0000-4000-8000-000000000004',
    username: 'nickfades',
    fullName: 'Nick Fadden',
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
      { line: 3.5, americanOdds: -140, units: 1, result: 'WON' },
      { line: 4.5, americanOdds: 160, units: 0.5, result: 'WON' },
      { line: 5.5, americanOdds: 320, units: 0.25, result: 'WON' },
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

type GroupLeg = Leg & { by: string; result?: Result };

/**
 * One group parlay still taking legs, and one that locked and got busted by a
 * single leg, so both states show in the feed.
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
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const g of groups) {
    const decimal = parlayDecimal(g.legs.map((l) => l.americanOdds));
    const results = g.legs.map((l) => l.result ?? 'PENDING');
    // Matches groupResult in shared/posts: any loss sinks it
    let result: Result = 'PENDING';
    if (results.includes('LOST')) result = 'LOST';
    else if (results.every((r) => r === 'WON')) result = 'WON';
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
        bets: {
          create: [
            {
              order: 0,
              units: 1,
              americanOdds: decimalToAmerican(decimal),
              decimalOdds: decimal,
              result,
              settledAt: result === 'PENDING' ? null : new Date(now),
              legs: {
                create: g.legs.map(({ by, result: legResult, ...leg }, i) => ({
                  ...legData(leg, i),
                  result: legResult ?? 'PENDING',
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
        bets: { create: betsData(post) },
      },
      include: { bets: true },
    });
    created.push(row);
  }

  // Friends tail each other's bets (never their own) so tail counts show up
  // (0, 1 or 2 tailers per post down the feed; the top slip gets everyone,
  // which makes it a crowd pick)
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
