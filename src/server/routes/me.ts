import express, { Router } from 'express';
import { z } from 'zod';
import type { User } from '../../generated/prisma/client';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import {
  AVATAR_MAX_BYTES,
  AvatarError,
  removeAvatarFile,
  uploadAvatar,
} from '../avatars';
import { SERIES_COLORS } from '../../shared/series';

const router = Router();

export const ownProfile = ({
  id,
  username,
  fullName,
  avatarUrl,
  avatarColor,
  bio,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  isAdmin,
  createdAt,
  tutorialSeenAt,
}: User) => ({
  id,
  username,
  fullName,
  avatarUrl,
  avatarColor,
  bio,
  subscriptionStatus,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  isAdmin,
  createdAt,
  tutorialSeenAt,
});

router.get('/', requireAuth, (req, res) => {
  res.json(ownProfile(req.user!));
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(60).optional(),
  bio: z.string().trim().max(160, 'Bio is 160 characters max').optional(),
  avatarColor: z.enum(SERIES_COLORS).optional(),
});

/** Edit your own name / bio / monogram color (username stays fixed) */
router.patch('/', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' });
    return;
  }
  const { fullName, bio, avatarColor } = parsed.data;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(bio !== undefined && { bio: bio || null }),
      ...(avatarColor && { avatarColor }),
    },
  });
  res.json(ownProfile(user));
});

/** Finished or skipped the first-visit tour; it won't open on its own again */
router.post('/tutorial', requireAuth, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { tutorialSeenAt: req.user!.tutorialSeenAt ?? new Date() },
  });
  res.json(ownProfile(user));
});

/**
 * Set your profile photo. The body is the image itself (the browser sends a
 * 256px square); its type is checked from the bytes, not the header.
 */
router.put(
  '/avatar',
  requireAuth,
  express.raw({ type: 'image/*', limit: AVATAR_MAX_BYTES }),
  async (req, res) => {
    let url: string;
    try {
      url = await uploadAvatar(req.user!.id, req.body);
    } catch (err) {
      if (err instanceof AvatarError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('Avatar upload failed', err);
      res.status(502).json({ error: 'Could not save your photo' });
      return;
    }
    const previous = req.user!.avatarUrl;
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: url },
    });
    await removeAvatarFile(previous);
    res.json(ownProfile(user));
  }
);

/** Remove your profile photo (back to your initial) */
router.delete('/avatar', requireAuth, async (req, res) => {
  const previous = req.user!.avatarUrl;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatarUrl: null },
  });
  await removeAvatarFile(previous);
  res.json(ownProfile(user));
});

export default router;
