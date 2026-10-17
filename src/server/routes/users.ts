import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import {
  isStatRange,
  profileStats,
  rangeStart,
  sinceFilter,
  StatBet,
  statLine,
  StatRange,
  UserProfile,
} from '../../shared/stats';

const router = Router();

/**
 * Profile + betting stats for `?range=7d|30d|all` (default all). Stats are
 * worked out from every bet in memory; fine at friend-group scale.
 */
router.get<{ username: string }>(
  '/:username',
  requireAuth,
  async (req, res) => {
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: req.params.username, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { query } = req;
    const range: StatRange = isStatRange(query.range) ? query.range : 'all';
    const since = rangeStart(range);
    const viewerId = req.user!.id;

    const posts = await prisma.post.findMany({
      where: { authorId: user.id, deletedAt: null },
      select: {
        id: true,
        type: true,
        createdAt: true,
        bets: {
          select: {
            order: true,
            units: true,
            decimalOdds: true,
            result: true,
            legs: { select: { sportKey: true } },
            tails: { select: { userId: true } },
          },
        },
      },
    });

    type Bet = StatBet & { postId: string; tailers: string[] };
    const all: Bet[] = posts.flatMap((p) =>
      p.bets.map((b) => ({
        postId: p.id,
        type: p.type,
        createdAt: p.createdAt,
        order: b.order,
        sportKey: b.legs.every((l) => l.sportKey === b.legs[0]?.sportKey)
          ? (b.legs[0]?.sportKey ?? null)
          : null,
        units: b.units.toNumber(),
        decimalOdds: b.decimalOdds.toNumber(),
        result: b.result,
        tailers: b.tails.map((t) => t.userId),
      }))
    );
    const bets = all.filter(sinceFilter(since));
    const viewerTailed = bets.filter((b) => b.tailers.includes(viewerId));
    // A ladder tail lands on every rung; count each person once per slip
    const slipTails = new Set(
      bets.flatMap((b) => b.tailers.map((u) => `${u}:${b.postId}`))
    );

    const body: UserProfile = {
      user: { ...user, createdAt: user.createdAt.toISOString() },
      range,
      stats: profileStats(all, since),
      tails: {
        received: slipTails.size,
        tailers: new Set(bets.flatMap((b) => b.tailers)).size,
        line: statLine(bets.filter((b) => b.tailers.length > 0)),
      },
      viewerTails:
        user.id !== viewerId && viewerTailed.length
          ? statLine(viewerTailed)
          : null,
    };
    res.json(body);
  }
);

export default router;
