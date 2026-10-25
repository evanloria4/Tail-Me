import { isPaid, type SubscriptionStatus } from './billing';

// The admin page (/admin): everyone's account and plan, from GET /api/admin/users

export type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  /** Monogram background when there's no photo */
  avatarColor: string;
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

// ---------- Odds API credits (GET /api/admin/credits) ----------

/** Credits spent over the page's windows (CT days, today included) */
export type CreditTotals = {
  today: number;
  week: number;
  month: number;
  total: number;
  /** Paid calls, all time */
  calls: number;
};

export type UserCredits = CreditTotals & {
  user: Pick<
    AdminUser,
    'id' | 'username' | 'fullName' | 'avatarUrl' | 'avatarColor'
  >;
};

export type CreditsPage = {
  /** The shared key's month so far (null if the check failed) */
  balance: { used: number; remaining: number } | null;
  /** First tracked day ("YYYY-MM-DD"), null before any usage */
  since: string | null;
  totals: CreditTotals;
  /** People who've spent credits, most this month first */
  users: UserCredits[];
};

export type UsageRow = {
  userId: string;
  day: string;
  credits: number;
  calls: number;
};

const emptyTotals = (): CreditTotals => ({
  today: 0,
  week: 0,
  month: 0,
  total: 0,
  calls: 0,
});

/**
 * Sums usage rows per person. Day keys compare as strings ("YYYY-MM-DD"):
 * `weekStart` / `monthStart` are the first days counted (6 and 29 days ago).
 */
export function sumCredits(
  rows: UsageRow[],
  days: { today: string; weekStart: string; monthStart: string }
): { totals: CreditTotals; byUser: Map<string, CreditTotals> } {
  const totals = emptyTotals();
  const byUser = new Map<string, CreditTotals>();
  rows.forEach((r) => {
    const mine = byUser.get(r.userId) ?? emptyTotals();
    byUser.set(r.userId, mine);
    [totals, mine].forEach((t) => {
      /* eslint-disable no-param-reassign */
      t.total += r.credits;
      t.calls += r.calls;
      if (r.day >= days.monthStart) t.month += r.credits;
      if (r.day >= days.weekStart) t.week += r.credits;
      if (r.day === days.today) t.today += r.credits;
      /* eslint-enable no-param-reassign */
    });
  });
  return { totals, byUser };
}
