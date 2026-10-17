import { describe, expect, it } from 'vitest';
import type { BetResult } from './posts';
import {
  bestWinStreak,
  currentStreak,
  profileStats,
  rangeStart,
  StatBet,
  statLine,
} from './stats';

let day = 0;
/** Bets get increasing dates in the order they're made */
function bet(
  result: BetResult,
  {
    units = 1,
    odds = 2,
    type = 'STRAIGHT',
    sport = 'nfl',
  }: {
    units?: number;
    odds?: number;
    type?: StatBet['type'];
    sport?: string | null;
  } = {}
): StatBet {
  day += 1;
  return {
    type,
    sportKey: sport,
    createdAt: new Date(2026, 8, day),
    order: 0,
    units,
    decimalOdds: odds,
    result,
  };
}

/** One ladder: rungs share a post date and climb in order */
function ladder(results: BetResult[]): StatBet[] {
  day += 1;
  return results.map((result, order) => ({
    type: 'LADDER',
    sportKey: 'nfl',
    createdAt: new Date(2026, 8, day),
    order,
    units: 1,
    decimalOdds: 2 + order,
    result,
  }));
}

describe('statLine', () => {
  it('counts record, units and ROI over settled bets only', () => {
    const line = statLine([
      bet('WON', { units: 2, odds: 1.9 }), // +1.8
      bet('LOST'), // -1
      bet('PUSH'), // 0, still risked
      bet('PENDING', { units: 5 }),
      bet('VOID', { units: 3 }),
    ]);
    expect(line).toMatchObject({
      wins: 1,
      losses: 1,
      pushes: 1,
      pending: 1,
      risked: 4,
      net: 0.8,
    });
    expect(line.roi).toBeCloseTo(0.2);
  });

  it('counts each ladder rung as its own result', () => {
    // 1u at 2.0 wins (+1), 1u at 3.0 wins (+2), 1u at 4.0 loses (-1)
    expect(statLine(ladder(['WON', 'WON', 'LOST']))).toMatchObject({
      wins: 2,
      losses: 1,
      risked: 3,
      net: 2,
    });
  });

  it('has no ROI before anything settles', () => {
    expect(statLine([bet('PENDING')]).roi).toBeNull();
  });
});

describe('streaks', () => {
  it('reads the current run from the newest settled bet, skipping pushes', () => {
    const bets = [
      bet('LOST'),
      bet('WON'),
      bet('PUSH'),
      bet('WON'),
      bet('PENDING'),
    ];
    expect(currentStreak(bets)).toEqual({ kind: 'W', count: 2 });
    expect(currentStreak([bet('LOST'), bet('LOST')])).toEqual({
      kind: 'L',
      count: 2,
    });
    expect(currentStreak([bet('PENDING')])).toBeNull();
  });

  it('orders by post date, then ladder rung', () => {
    const older = bet('WON');
    const newer = bet('LOST');
    expect(currentStreak([newer, older])).toEqual({ kind: 'L', count: 1 });
    // Top rung missed last
    expect(currentStreak(ladder(['WON', 'WON', 'LOST']).reverse())).toEqual({
      kind: 'L',
      count: 1,
    });
  });

  it('finds the best win streak', () => {
    expect(
      bestWinStreak([
        bet('WON'),
        bet('WON'),
        bet('LOST'),
        bet('WON'),
        bet('PUSH'),
        bet('WON'),
        bet('WON'),
      ])
    ).toBe(3);
  });
});

describe('profileStats', () => {
  const bets = [
    bet('WON', { sport: 'nhl' }),
    bet('LOST', { type: 'PARLAY', sport: null }), // NFL + NHL legs
    bet('LOST'),
    ...ladder(['WON', 'LOST']),
  ];

  it('breaks down by type and league, newest results first', () => {
    const stats = profileStats(bets);
    expect(stats.overall).toMatchObject({ wins: 2, losses: 3 });
    expect(stats.byType.STRAIGHT).toMatchObject({ wins: 1, losses: 1 });
    expect(stats.byType.PARLAY).toMatchObject({ wins: 0, losses: 1 });
    expect(stats.byType.LADDER).toMatchObject({ wins: 1, losses: 1, net: 0 });
    expect(stats.recent).toEqual(['LOST', 'WON', 'LOST', 'LOST', 'WON']);
  });

  it('leaves multi-league parlays out of the league records', () => {
    expect(profileStats(bets).bySport).toEqual([
      {
        sportKey: 'nfl',
        line: expect.objectContaining({ wins: 1, losses: 2 }),
      },
      {
        sportKey: 'nhl',
        line: expect.objectContaining({ wins: 1, losses: 0 }),
      },
    ]);
  });

  it('takes the current streak from outside the range', () => {
    const old = bet('WON');
    const recent = bet('WON');
    const stats = profileStats([old, recent], recent.createdAt);
    expect(stats.overall.wins).toBe(1);
    expect(stats.streak).toEqual({ kind: 'W', count: 2 });
  });
});

describe('rangeStart', () => {
  it('goes back the right number of days', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(rangeStart('7d', now)?.toISOString()).toBe(
      '2026-10-09T12:00:00.000Z'
    );
    expect(rangeStart('all', now)).toBeNull();
  });
});
