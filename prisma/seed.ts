import prisma from '../src/server/db';

const sports = [
  { key: 'americanfootball_nfl', title: 'NFL' },
  { key: 'americanfootball_ncaaf', title: 'NCAA Football' },
  { key: 'basketball_nba', title: 'NBA' },
  { key: 'icehockey_nhl', title: 'NHL' },
  { key: 'mma_mixed_martial_arts', title: 'UFC' },
];

const sportsbooks = [
  { key: 'draftkings', name: 'DraftKings', supportsDeepLink: true },
  { key: 'fanduel', name: 'FanDuel', supportsDeepLink: true },
  { key: 'betmgm', name: 'BetMGM', supportsDeepLink: true },
  { key: 'williamhill_us', name: 'Caesars', supportsDeepLink: true },
  { key: 'fanatics', name: 'Fanatics', supportsDeepLink: false },
  { key: 'espnbet', name: 'ESPN BET', supportsDeepLink: false },
];

async function main() {
  await Promise.all(
    sports.map((s) =>
      prisma.sport.upsert({ where: { key: s.key }, update: s, create: s })
    )
  );
  await Promise.all(
    sportsbooks.map((b) =>
      prisma.sportsbook.upsert({ where: { key: b.key }, update: b, create: b })
    )
  );
  console.log(`Seeded ${sports.length} sports, ${sportsbooks.length} books`);
}

main().finally(() => prisma.$disconnect());
