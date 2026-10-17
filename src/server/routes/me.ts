import { Router } from 'express';
import { z } from 'zod';
import type { User } from '../../generated/prisma/client';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

const ownProfile = ({
  id,
  username,
  fullName,
  avatarUrl,
  bio,
  subscriptionStatus,
  currentPeriodEnd,
  isAdmin,
  createdAt,
}: User) => ({
  id,
  username,
  fullName,
  avatarUrl,
  bio,
  subscriptionStatus,
  currentPeriodEnd,
  isAdmin,
  createdAt,
});

router.get('/', requireAuth, (req, res) => {
  res.json(ownProfile(req.user!));
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(60).optional(),
  bio: z.string().trim().max(160, 'Bio is 160 characters max').optional(),
});

/** Edit your own name / bio (username stays fixed) */
router.patch('/', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' });
    return;
  }
  const { fullName, bio } = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(bio !== undefined && { bio: bio || null }),
    },
  });
  res.json(ownProfile(user));
});

export default router;
