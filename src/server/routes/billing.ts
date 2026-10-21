import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import type Stripe from 'stripe';
import type { User } from '../../generated/prisma/client';
import { isPaid, promoTrialEnd } from '../../shared/billing';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import { getStripe, syncCustomer } from '../stripe';
import { ownProfile } from './me';

// Payments go through Stripe-hosted Checkout and the billing portal, so card
// details never reach this server. Access only changes from what Stripe says
// (webhook or sync), never from the browser landing on a success URL.

const router = Router();

const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

/** Stripe client + the site's own URL for redirects (never the request's Host header) */
function billingConfig() {
  const stripe = getStripe();
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  const priceId = process.env.STRIPE_PRICE_ID;
  return stripe && appUrl && priceId ? { stripe, appUrl, priceId } : null;
}

async function customerFor(stripe: Stripe, user: User) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  // Same key for a user's concurrent clicks, so they get one customer
  const customer = await stripe.customers.create(
    {
      name: user.fullName,
      metadata: { userId: user.id, username: user.username },
    },
    { idempotencyKey: `customer-${user.id}` }
  );
  await prisma.user.updateMany({
    where: { id: user.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Starts a $5/mo Checkout; returns the Stripe-hosted page to send the browser to */
router.post('/checkout', requireAuth, billingLimiter, async (req, res) => {
  const config = billingConfig();
  if (!config) {
    res.status(503).json({ error: 'Payments aren’t set up yet' });
    return;
  }
  const { stripe, appUrl, priceId } = config;
  const user = req.user!;
  if (isPaid(user.subscriptionStatus)) {
    res.status(409).json({ error: 'You’re already subscribed' });
    return;
  }

  const customer = await customerFor(stripe, user);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { userId: user.id },
      trial_end: promoTrialEnd(),
    },
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/billing`,
  });
  res.json({ url: session.url });
});

/** Stripe's billing portal: change card, see invoices, cancel */
router.post('/portal', requireAuth, billingLimiter, async (req, res) => {
  const config = billingConfig();
  if (!config) {
    res.status(503).json({ error: 'Payments aren’t set up yet' });
    return;
  }
  const customer = req.user!.stripeCustomerId;
  if (!customer) {
    res.status(400).json({ error: 'No billing account yet' });
    return;
  }
  const session = await config.stripe.billingPortal.sessions.create({
    customer,
    return_url: `${config.appUrl}/billing?from=portal`,
  });
  res.json({ url: session.url });
});

/** Re-reads your subscription from Stripe (back from Checkout before the webhook lands) */
router.post('/sync', requireAuth, billingLimiter, async (req, res) => {
  const stripe = getStripe();
  const user = req.user!;
  if (!stripe || !user.stripeCustomerId) {
    res.json(ownProfile(user));
    return;
  }
  await syncCustomer(stripe, user.stripeCustomerId);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  res.json(ownProfile(fresh));
});

/**
 * Stripe webhook. Mounted in app.ts ahead of express.json because the
 * signature is checked against the raw body.
 */
export async function stripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    res.status(503).json({ error: 'Payments aren’t set up yet' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'] ?? '',
      secret
    );
  } catch {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (await prisma.stripeEvent.findUnique({ where: { id: event.id } })) {
    res.json({ received: true });
    return;
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type.startsWith('customer.subscription.')
  ) {
    const { customer } = event.data.object as {
      customer?: string | { id: string } | null;
    };
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    if (customerId) await syncCustomer(stripe, customerId);
  }

  // Recorded after handling, so a failed sync is retried by Stripe
  await prisma.stripeEvent.createMany({
    data: [{ id: event.id, type: event.type }],
    skipDuplicates: true,
  });
  res.json({ received: true });
}

export default router;
