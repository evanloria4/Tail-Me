import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import { isHot } from '../../shared/badges';
import {
  CommunityStats,
  dailyTotals,
  dayKey,
  isTimeZone,
} from '../../shared/community';
import {
  currentStreak,
  rangeStart,
  StatBet,
  statLine,
} from '../../shared/stats';

const router = Router();

/** Top earners shown for the week */
const LEADERS = 3;

/**
 * Feed side column. `?tz=<IANA zone>` buckets days the way the viewer sees
 * them; `?month=YYYY-MM` picks the calendar month (default: this month).
 * Worked out from every settled bet in memory; fine at friend-group scale.
 */
router.get('/', requireAuth, async (req, res) => {
  const tz = isTimeZone(req.query.tz) ? req.query.tz : 'UTC';
  const month =
    typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : dayKey(new Date(), tz).slice(0, 7);

  const [users, rows] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, fullName: true },
    }),
    prisma.bet.findMany({
      where: {
        post: { deletedAt: null },
        result: { in: ['WON', 'LOST', 'PUSH'] },
      },
      select: {
        order: true,
        units: true,
        decimalOdds: true,
        result: true,
        post: { select: { authorId: true, type: true, createdAt: true } },
      },
    }),
  ]);

  const bets = rows.map((b) => ({
    authorId: b.post.authorId,
    type: b.post.type,
    sportKey: null,
    createdAt: b.post.createdAt,
    order: b.order,
    units: b.units.toNumber(),
    decimalOdds: b.decimalOdds.toNumber(),
    result: b.result,
  })) satisfies (StatBet & { authorId: string })[];

  const weekStart = rangeStart('7d')!;
  const byUser = users.map((u) => {
    const mine = bets.filter((b) => b.authorId === u.id);
    return {
      user: u,
      streak: currentStreak(mine),
      week: statLine(mine.filter((b) => b.createdAt >= weekStart)),
    };
  });

  const body: CommunityStats = {
    hot: byUser
      .filter((u) => isHot(u.streak))
      .sort((a, b) => b.streak!.count - a.streak!.count)
      .map((u) => ({ ...u.user, streak: u.streak! })),
    leaders: byUser
      .filter((u) => u.week.net > 0)
      .sort((a, b) => b.week.net - a.week.net)
      .slice(0, LEADERS)
      .map((u) => ({ ...u.user, line: u.week })),
    days: dailyTotals(bets, tz).filter((d) => d.day.startsWith(month)),
    month,
  };
  res.json(body);
});

export default router;
