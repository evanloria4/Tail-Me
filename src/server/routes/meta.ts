import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

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
  res.json({ sports, sportsbooks });
});

export default router;
