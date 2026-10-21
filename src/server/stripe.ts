import Stripe from 'stripe';
import { isPaid, statusFromStripe } from '../shared/billing';
import prisma from './db';

let client: Stripe | null = null;

/** Stripe client, or null when STRIPE_SECRET_KEY isn't set (billing routes then 503) */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

/**
 * Copies a customer's subscription state from Stripe onto their user. Always
 * reads the current state instead of trusting an event's payload, so webhooks
 * arriving late, twice or out of order can't leave a stale status behind.
 */
export async function syncCustomer(stripe: Stripe, customerId: string) {
  const { data: subs } = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  // Newest first; a live subscription wins over ended ones
  const sub =
    subs.find((s) => isPaid(statusFromStripe(s.status))) ?? subs[0] ?? null;
  const periodEnd = sub?.cancel_at ?? sub?.items.data[0]?.current_period_end;

  const data = {
    stripeSubscriptionId: sub?.id ?? null,
    subscriptionStatus: sub ? statusFromStripe(sub.status) : 'NONE',
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: !!sub && (sub.cancel_at_period_end || !!sub.cancel_at),
  } as const;

  const { count } = await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data,
  });
  if (count > 0) return;

  // Customer made at checkout but never saved to the user: link it by the
  // userId we stamp on every customer we create
  const customer = await stripe.customers.retrieve(customerId);
  const userId = !customer.deleted ? customer.metadata.userId : undefined;
  if (!userId) return;
  await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { ...data, stripeCustomerId: customerId },
  });
}
