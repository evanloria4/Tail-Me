import { describe, expect, it } from 'vitest';
import { sumCredits, userCounts, type AdminUser } from './admin';

describe('sumCredits', () => {
  const days = {
    today: '2026-10-25',
    weekStart: '2026-10-19',
    monthStart: '2026-09-26',
  };
  const row = (userId: string, day: string, credits: number) => ({
    userId,
    day,
    credits,
    calls: 1,
  });

  it('sums each person and the group over today, 7 and 30 days', () => {
    const { totals, byUser } = sumCredits(
      [
        row('a', '2026-10-25', 3),
        row('a', '2026-10-19', 17),
        row('a', '2026-10-18', 5),
        row('b', '2026-09-01', 40),
      ],
      days
    );
    expect(byUser.get('a')).toEqual({
      today: 3,
      week: 20,
      month: 25,
      total: 25,
      calls: 3,
    });
    expect(byUser.get('b')).toMatchObject({ month: 0, total: 40 });
    expect(totals).toEqual({
      today: 3,
      week: 20,
      month: 25,
      total: 65,
      calls: 4,
    });
  });
});

const user = (extra: Partial<AdminUser>): AdminUser => ({
  id: 'u',
  username: 'u',
  fullName: 'U',
  avatarUrl: null,
  avatarColor: 'emerald',
  isAdmin: false,
  subscriptionStatus: 'NONE',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});

describe('userCounts', () => {
  it('counts paying statuses as subscribed, not free or canceled', () => {
    const counts = userCounts([
      user({ subscriptionStatus: 'ACTIVE' }),
      user({ subscriptionStatus: 'ACTIVE', cancelAtPeriodEnd: true }),
      user({ subscriptionStatus: 'TRIALING' }),
      user({ subscriptionStatus: 'PAST_DUE' }),
      user({ subscriptionStatus: 'CANCELED' }),
      // Admins get access free, but only count if they're paying
      user({ isAdmin: true }),
    ]);
    expect(counts).toEqual({
      total: 6,
      subscribed: 4,
      trialing: 1,
      pastDue: 1,
      canceling: 1,
    });
  });
});
