import { isPaid, type SubscriptionStatus } from './billing';

// The admin page (/admin): everyone's account and plan, from GET /api/admin/users

export type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  subscriptionStatus: SubscriptionStatus;
  /** Renewal date, or when access ends if canceled */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

/** Head counts for the page's tiles; "subscribed" means paying (isPaid) */
export function userCounts(users: AdminUser[]) {
  const subscribed = users.filter((u) => isPaid(u.subscriptionStatus));
  return {
    total: users.length,
    subscribed: subscribed.length,
    trialing: subscribed.filter((u) => u.subscriptionStatus === 'TRIALING')
      .length,
    pastDue: subscribed.filter((u) => u.subscriptionStatus === 'PAST_DUE')
      .length,
    canceling: subscribed.filter((u) => u.cancelAtPeriodEnd).length,
  };
}
