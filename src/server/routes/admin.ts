import { Router } from 'express';
import prisma from '../db';
import { requireAdmin, requireAuth } from '../middleware/auth';
import type { AdminUser } from '../../shared/admin';

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

export default router;
