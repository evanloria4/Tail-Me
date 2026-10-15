import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

/** How books are listed in pickers; any book not named here goes last, A-Z */
const BOOK_ORDER = [
  'fanduel',
  'draftkings',
  'williamhill_us', // Caesars
  'betmgm',
  'espnbet',
  'fanatics',
];
const bookRank = (key: string) => {
  const i = BOOK_ORDER.indexOf(key);
  return i === -1 ? BOOK_ORDER.length : i;
};

/** Sports and sportsbooks for pickers */
router.get('/', requireAuth, async (_req, res) => {
  const [sports, sportsbooks] = await Promise.all([
    prisma.sport.findMany({
      where: { active: true },
      select: { key: true, title: true },
      orderBy: { title: 'asc' },
    }),
    prisma.sportsbook.findMany({
      where: { active: true },
      select: { key: true, name: true, supportsDeepLink: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  sportsbooks.sort((a, b) => bookRank(a.key) - bookRank(b.key));
  res.json({ sports, sportsbooks });
});

export default router;
