import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const {
    id,
    username,
    fullName,
    avatarUrl,
    bio,
    subscriptionStatus,
    currentPeriodEnd,
    isAdmin,
    createdAt,
  } = req.user!;
  res.json({
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
});

export default router;
