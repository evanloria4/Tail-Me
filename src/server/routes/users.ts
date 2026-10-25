import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import {
  isPersonalType,
  isStatRange,
  POST_TYPES,
  profileStats,
  rangeStart,
  sinceFilter,
  StatBet,
  StatRange,
  UserProfile,
} from '../../shared/stats';
import { gooseEggs, nearMisses } from '../../shared/records';
import type { BetResult } from '../../shared/posts';

const router = Router();

/** Most people one search returns */
const SEARCH_LIMIT = 8;

/**
 * Navbar search: `?q=` matches anywhere in a name or username (any case).
 * Names starting with the query come first, then A-Z.
 */
router.get('/', requireAuth, async (req, res) => {
  const q =
    typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
  if (!q) {
    res.json([]);
    return;
  }
  const people = await prisma.user.findMany({
    where: {
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      avatarColor: true,
    },
    orderBy: { fullName: 'asc' },
    take: 50,
  });
  const lower = q.toLowerCase();
  const starts = (p: (typeof people)[number]) =>
    p.fullName.toLowerCase().startsWith(lower) ||
    p.username.toLowerCase().startsWith(lower);
  res.json(
    [...people]
      .sort((x, y) => Number(starts(y)) - Number(starts(x)))
      .slice(0, SEARCH_LIMIT)
  );
});

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
        avatarColor: true,
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

    // Group parlays keep their own record, so they never touch these stats.
    // Deleted slips still count: deleting a loser can't clean up a record.
    const posts = await prisma.post.findMany({
      where: { authorId: user.id, type: { in: POST_TYPES } },
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
            legs: { select: { sportKey: true, result: true } },
            tails: { select: { userId: true } },
          },
        },
      },
    });

    type Bet = StatBet & {
      postId: string;
      tailers: string[];
      legs: BetResult[];
    };
    const all: Bet[] = posts.flatMap((p) => {
      const { type } = p;
      if (!isPersonalType(type)) return [];
      return p.bets.map((b) => ({
        postId: p.id,
        type,
        createdAt: p.createdAt,
        order: b.order,
        sportKey: b.legs.every((l) => l.sportKey === b.legs[0]?.sportKey)
          ? (b.legs[0]?.sportKey ?? null)
          : null,
        units: b.units.toNumber(),
        decimalOdds: b.decimalOdds.toNumber(),
        result: b.result,
        tailers: b.tails.map((t) => t.userId),
        legs: b.legs.map((l) => l.result),
      }));
    });
    const bets = all.filter(sinceFilter(since));
    // A ladder tail lands on every rung; count each person once per slip
    const slipTails = new Set(
      bets.flatMap((b) => b.tailers.map((u) => `${u}:${b.postId}`))
    );

    const body: UserProfile = {
      user: { ...user, createdAt: user.createdAt.toISOString() },
      range,
      stats: profileStats(all, since),
      nearMisses: nearMisses(bets),
      gooseEggs: gooseEggs(bets),
      tails: {
        received: slipTails.size,
        tailers: new Set(bets.flatMap((b) => b.tailers)).size,
      },
    };
    res.json(body);
  }
);

export default router;
