import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import { recordsPage } from '../../shared/records';
import type { RecordBet, RecordGroupParlay } from '../../shared/records';
import {
  isPersonalType,
  isStatRange,
  rangeStart,
  StatRange,
} from '../../shared/stats';

// The Records page: GET /api/records?range=7d|30d|all. Everyone's bets are
// loaded and counted in memory, like profiles (fine at friend-group size).
// Deleted slips still count: deleting a loser can't clean up a record.

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const range: StatRange = isStatRange(req.query.range)
    ? req.query.range
    : 'all';

  const [people, posts] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        avatarColor: true,
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.post.findMany({
      select: {
        id: true,
        type: true,
        authorId: true,
        createdAt: true,
        _count: { select: { fades: true } },
        bets: {
          select: {
            order: true,
            units: true,
            decimalOdds: true,
            americanOdds: true,
            result: true,
            legs: {
              select: { sportKey: true, result: true, addedById: true },
            },
            _count: { select: { tails: true } },
          },
        },
      },
    }),
  ]);

  const bets: RecordBet[] = [];
  const groupParlays: RecordGroupParlay[] = [];
  posts.forEach((p) => {
    const { type } = p;
    if (type === 'GROUP_PARLAY') {
      const bet = p.bets[0];
      if (!bet) return;
      groupParlays.push({
        postId: p.id,
        createdAt: p.createdAt,
        result: bet.result,
        legs: bet.legs.map((l) => ({
          addedById: l.addedById,
          result: l.result,
        })),
      });
      return;
    }
    if (!isPersonalType(type)) return;
    p.bets.forEach((b) => {
      bets.push({
        type,
        authorId: p.authorId,
        postId: p.id,
        createdAt: p.createdAt,
        order: b.order,
        sportKey: b.legs.every((l) => l.sportKey === b.legs[0]?.sportKey)
          ? (b.legs[0]?.sportKey ?? null)
          : null,
        units: b.units.toNumber(),
        decimalOdds: b.decimalOdds.toNumber(),
        americanOdds: b.americanOdds,
        result: b.result,
        // One tail row per person per bet, so this is distinct people
        tails: b._count.tails,
        fades: p._count.fades,
        legs: b.legs.map((l) => l.result),
      });
    });
  });

  res.json(recordsPage(range, rangeStart(range), people, bets, groupParlays));
});

export default router;
