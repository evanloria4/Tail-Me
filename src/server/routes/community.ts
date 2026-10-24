import { Router } from 'express';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import { isHot } from '../../shared/badges';
import { CommunityStats, dailyTotals } from '../../shared/community';
import { groupRow } from '../../shared/records';
import { siteDayKey } from '../../shared/time';
import {
  currentStreak,
  isPersonalType,
  rangeStart,
  StatBet,
  statLine,
} from '../../shared/stats';

const router = Router();

/** Top earners shown for the week */
const LEADERS = 3;

/**
 * Feed side column. Days are Central time like the rest of the site;
 * `?month=YYYY-MM` picks the calendar month (default: this month).
 * Worked out from every settled bet in memory; fine at friend-group scale.
 */
router.get('/', requireAuth, async (req, res) => {
  const month =
    typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : siteDayKey(new Date()).slice(0, 7);

  const [users, rows, groupLegs] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        avatarColor: true,
      },
    }),
    prisma.bet.findMany({
      // Deleted slips still count toward records and the calendar
      where: { result: { not: 'VOID' } },
      select: {
        order: true,
        units: true,
        decimalOdds: true,
        result: true,
        post: { select: { authorId: true, type: true, createdAt: true } },
      },
    }),
    // Whole group parlays, so a leg can be told apart as the only miss
    prisma.bet.findMany({
      where: { post: { type: 'GROUP_PARLAY' } },
      select: {
        result: true,
        decimalOdds: true,
        postId: true,
        post: { select: { createdAt: true } },
        legs: { select: { addedById: true, result: true } },
      },
    }),
  ]);

  // Personal bets drive streaks, earners and the calendar; group parlays
  // only feed the group record
  const bets = rows.flatMap((b) => {
    const { type } = b.post;
    if (!isPersonalType(type)) return [];
    return [
      {
        authorId: b.post.authorId,
        type,
        sportKey: null,
        createdAt: b.post.createdAt,
        order: b.order,
        units: b.units.toNumber(),
        decimalOdds: b.decimalOdds.toNumber(),
        result: b.result,
      },
    ];
  }) satisfies (StatBet & { authorId: string })[];
  const groupResults = rows
    .filter((b) => b.post.type === 'GROUP_PARLAY')
    .map((b) => b.result);

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
    days: dailyTotals(bets).filter((d) => d.day.startsWith(month)),
    month,
    group: {
      wins: groupResults.filter((r) => r === 'WON').length,
      losses: groupResults.filter((r) => r === 'LOST').length,
      pushes: groupResults.filter((r) => r === 'PUSH').length,
      open: groupResults.filter((r) => r === 'PENDING').length,
      legs: users
        .map((u) => {
          const { hit, busted, onlyMiss } = groupRow(
            u,
            groupLegs.map((b) => ({
              postId: b.postId,
              createdAt: b.post.createdAt,
              result: b.result,
              decimalOdds: b.decimalOdds.toNumber(),
              legs: b.legs,
            }))
          );
          return { ...u, hit, busted, onlyMiss };
        })
        .filter((u) => u.hit + u.busted > 0)
        .sort((a, b) => b.hit - a.hit || a.busted - b.busted),
    },
  };
  res.json(body);
});

export default router;
