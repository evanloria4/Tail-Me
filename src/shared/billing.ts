// Who gets subscriber features (posting, live odds), shared by the server's
// requireSubscription gate and the client's useAuth().isSubscribed.

export type SubscriptionStatus =
  | 'NONE'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED';

export const PRICE_LABEL = '$5/month';

/** Launch promo: everyone gets subscriber features through Oct 31 (ends midnight Nov 1 CT) */
export const FREE_UNTIL = new Date('2026-11-01T05:00:00Z');

export const isPromoActive = (now = new Date()) => now < FREE_UNTIL;

/** PAST_DUE keeps access while Stripe retries the card; it cancels if retries fail */
const PAID: readonly SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

export const isPaid = (status: SubscriptionStatus) => PAID.includes(status);

export function hasAccess(
  user: { isAdmin: boolean; subscriptionStatus: SubscriptionStatus },
  now = new Date()
) {
  return user.isAdmin || isPaid(user.subscriptionStatus) || isPromoActive(now);
}

/** Stripe needs a Checkout trial to end at least 48h out; pad it by an hour */
const MIN_TRIAL_MS = 49 * 60 * 60 * 1000;

/**
 * Subscribing during the promo starts billing when it ends (unix seconds for
 * Checkout's trial_end). Too close to the end, billing just starts now.
 */
export function promoTrialEnd(now = new Date()): number | undefined {
  if (FREE_UNTIL.getTime() - now.getTime() < MIN_TRIAL_MS) return undefined;
  return Math.floor(FREE_UNTIL.getTime() / 1000);
}

/** Collapses Stripe's subscription statuses into ours */
export function statusFromStripe(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      // incomplete (first payment never went through), paused
      return 'NONE';
  }
}
