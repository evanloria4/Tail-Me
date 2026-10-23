import { describe, expect, it } from 'vitest';
import { userCounts, type AdminUser } from './admin';

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
