import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Profile } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import { useToast } from '../components/Toast';
import {
  FREE_UNTIL,
  isPaid,
  isPromoActive,
  PRICE_LABEL,
} from '../../shared/billing';
import { inSiteZone } from '../../shared/time';

// Subscribe / manage. Both buttons hand off to Stripe-hosted pages; access
// only changes once the server hears from Stripe.

const longDate = (date: Date | string) =>
  new Date(date).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'long', day: 'numeric', year: 'numeric' })
  );

const buttonClass =
  'rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-60';

function planLine(profile: Profile) {
  const end = profile.currentPeriodEnd && longDate(profile.currentPeriodEnd);
  if (profile.subscriptionStatus === 'PAST_DUE') {
    return 'Your last payment didn’t go through. Update your card to keep posting.';
  }
  if (profile.cancelAtPeriodEnd) {
    return end ? `Canceled. You can post until ${end}.` : 'Canceled.';
  }
  if (profile.subscriptionStatus === 'TRIALING') {
    return end
      ? `Free until ${end}, then ${PRICE_LABEL}.`
      : `Free trial, then ${PRICE_LABEL}.`;
  }
  return end ? `${PRICE_LABEL}, renews ${end}.` : `${PRICE_LABEL}.`;
}

export default function Billing() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  // Back from Checkout or the portal: ask the server to re-read Stripe in case
  // the webhook hasn't landed yet
  useEffect(() => {
    const fromCheckout = params.get('checkout') === 'success';
    if ((!fromCheckout && params.get('from') !== 'portal') || synced.current) {
      return;
    }
    synced.current = true;
    api
      .post('/billing/sync')
      .then(refreshProfile)
      .then(() => fromCheckout && toast('You’re subscribed. Thanks!'))
      .catch(() => {})
      .finally(() => setParams({}, { replace: true }));
  }, [params, setParams, refreshProfile, toast]);

  const goTo = async (path: '/billing/checkout' | '/billing/portal') => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ url: string }>(path);
      window.location.assign(data.url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reach Stripe'));
      setBusy(false);
    }
  };

  if (!profile) return null;
  const paid = isPaid(profile.subscriptionStatus);
  const promoEnds = longDate(new Date(FREE_UNTIL.getTime() - 1));

  let body: React.ReactNode;
  if (profile.isAdmin) {
    // Admins have full access whatever Stripe says; a test subscription is
    // still reachable through the small link
    body = (
      <>
        <h2 className="text-lg font-semibold">Admin account</h2>
        <p className="mt-1 text-gray-400">
          You have full access to everything. No subscription needed.
        </p>
        {paid && (
          <button
            type="button"
            disabled={busy}
            onClick={() => goTo('/billing/portal')}
            className="mt-4 text-sm font-medium text-gray-500 hover:text-white hover:underline disabled:opacity-60"
          >
            Manage your Stripe subscription
          </button>
        )}
      </>
    );
  } else if (paid) {
    body = (
      <>
        <h2 className="text-lg font-semibold">
          {profile.cancelAtPeriodEnd ? 'Subscription ending' : 'Subscribed'}
        </h2>
        <p className="mt-1 text-gray-400">{planLine(profile)}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => goTo('/billing/portal')}
          className={`${buttonClass} mt-5`}
        >
          Manage billing
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Change your card, see receipts or cancel on Stripe.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="text-lg font-semibold">Tail-Me {PRICE_LABEL}</h2>
        <p className="mt-1 text-gray-400">
          Post straights, parlays and ladders from live odds, and add legs to
          group parlays. Viewing and tailing stay free.
        </p>
        {isPromoActive() && (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Everything’s free through {promoEnds}. Subscribe now and you won’t
            be charged until {longDate(FREE_UNTIL)}.
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => goTo('/billing/checkout')}
          className={`${buttonClass} mt-5`}
        >
          Subscribe
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Secure checkout by Stripe. Cancel anytime.
        </p>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link
        to="/settings"
        className="mb-2 inline-block text-sm font-medium text-gray-400 hover:text-white"
      >
        ‹ Settings
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Billing</h1>
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        {body}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>
    </div>
  );
}
