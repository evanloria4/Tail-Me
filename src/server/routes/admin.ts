import { Router } from 'express';
import prisma from '../db';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { getCreditBalance } from '../odds';
import {
  sumCredits,
  type AdminUser,
  type CreditsPage,
} from '../../shared/admin';
import { siteDayKey } from '../../shared/time';

// Admin-only views (the /admin page)

const router = Router();
router.use(requireAuth, requireAdmin);

/** Every user with their plan, newest first */
router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      avatarColor: true,
      isAdmin: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      createdAt: true,
    },
  });
  const body: AdminUser[] = users.map((u) => ({
    ...u,
    currentPeriodEnd: u.currentPeriodEnd?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));
  res.json(body);
});

/** Days back from today, as a CT day key (noon keeps DST shifts off the edge) */
function daysAgoKey(today: string, days: number) {
  const noon = new Date(`${today}T12:00:00Z`);
  return siteDayKey(new Date(noon.getTime() - days * 86_400_000));
}

/**
 * Odds API credits: the shared key's month (free /sports check) and what
 * each person's picker / import requests spent, from OddsUsage
 */
router.get('/credits', async (_req, res) => {
  const today = siteDayKey(new Date());
  const [balance, rows] = await Promise.all([
    getCreditBalance(),
    prisma.oddsUsage.findMany({ orderBy: { day: 'asc' } }),
  ]);
  const { totals, byUser } = sumCredits(rows, {
    today,
    weekStart: daysAgoKey(today, 6),
    monthStart: daysAgoKey(today, 29),
  });
  const people = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      avatarColor: true,
    },
  });
  const users = people
    .map((user) => ({ user, ...byUser.get(user.id)! }))
    .sort((a, b) => b.month - a.month || b.total - a.total);
  const body: CreditsPage = {
    balance,
    since: rows[0]?.day ?? null,
    totals,
    users,
  };
  res.json(body);
});

export default router;
