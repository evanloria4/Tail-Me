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
import { notify, vapidPublicKey } from '../push';
import { SERIES_COLORS } from '../../shared/series';
import {
  notifyPrefs,
  notifyPrefsSchema,
  pushSubscriptionSchema,
} from '../../shared/notifications';

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

// ---------- Push notifications ----------

/**
 * The server's public key for subscribing (null when push isn't set up),
 * plus your switches. Whether this device is subscribed is the browser's to say.
 */
router.get('/notifications', requireAuth, (req, res) => {
  res.json({
    publicKey: vapidPublicKey(),
    prefs: notifyPrefs(req.user!.notifyPrefs),
  });
});

/** Flip some of your switches; returns all of them */
router.patch('/notifications', requireAuth, async (req, res) => {
  const parsed = notifyPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification settings' });
    return;
  }
  const prefs = { ...notifyPrefs(req.user!.notifyPrefs), ...parsed.data };
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { notifyPrefs: prefs },
  });
  res.json({ prefs });
});

/** This device turned notifications on (an endpoint moves with whoever signs in on it) */
router.post('/push', requireAuth, async (req, res) => {
  const parsed = pushSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid push subscription' });
    return;
  }
  const { endpoint, keys } = parsed.data;
  const data = { userId: req.user!.id, p256dh: keys.p256dh, auth: keys.auth };
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data,
  });
  res.status(204).end();
});

/** This device turned them off, or signed out */
router.delete('/push', requireAuth, async (req, res) => {
  const endpoint = z.string().safeParse(req.body?.endpoint);
  if (!endpoint.success) {
    res.status(400).json({ error: 'Missing endpoint' });
    return;
  }
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: endpoint.data, userId: req.user!.id },
  });
  res.status(204).end();
});

/** Settings' "Send a test": proves the whole path to your devices works */
router.post('/push/test', requireAuth, async (req, res) => {
  const devices = await prisma.pushSubscription.count({
    where: { userId: req.user!.id },
  });
  if (!devices || !vapidPublicKey()) {
    res.status(400).json({ error: 'Turn notifications on first' });
    return;
  }
  const firstName = req.user!.fullName.split(' ')[0];
  await notify([req.user!.id], null, {
    title: 'TailMe notifications are on 🔔',
    body: `Nice, ${firstName}. This is what they'll look like.`,
    url: '/settings',
  });
  res.status(204).end();
});

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
