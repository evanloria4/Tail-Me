import { describe, expect, it } from 'vitest';
import {
  FREE_UNTIL,
  hasAccess,
  promoTrialEnd,
  statusFromStripe,
} from './billing';

const OCT_20 = new Date('2026-10-20T17:00:00Z');
const NOV_2 = new Date('2026-11-02T17:00:00Z');
const free = { isAdmin: false, subscriptionStatus: 'NONE' as const };

describe('hasAccess', () => {
  it('lets everyone in during the promo', () => {
    expect(hasAccess(free, OCT_20)).toBe(true);
  });

  it('ends the promo at midnight Nov 1 Central', () => {
    expect(hasAccess(free, new Date('2026-11-01T04:59:00Z'))).toBe(true);
    expect(hasAccess(free, FREE_UNTIL)).toBe(false);
  });

  it('needs a paid status or admin afterwards', () => {
    expect(hasAccess(free, NOV_2)).toBe(false);
    expect(hasAccess({ ...free, subscriptionStatus: 'CANCELED' }, NOV_2)).toBe(
      false
    );
    expect(hasAccess({ ...free, subscriptionStatus: 'ACTIVE' }, NOV_2)).toBe(
      true
    );
    expect(hasAccess({ ...free, subscriptionStatus: 'PAST_DUE' }, NOV_2)).toBe(
      true
    );
    expect(hasAccess({ ...free, isAdmin: true }, NOV_2)).toBe(true);
  });
});

describe('promoTrialEnd', () => {
  it('defers billing to the end of the promo', () => {
    expect(promoTrialEnd(OCT_20)).toBe(FREE_UNTIL.getTime() / 1000);
  });

  it('skips the trial inside Stripe’s 48h minimum', () => {
    expect(promoTrialEnd(new Date('2026-10-30T12:00:00Z'))).toBeUndefined();
    expect(promoTrialEnd(NOV_2)).toBeUndefined();
  });
});

describe('statusFromStripe', () => {
  it('maps Stripe statuses', () => {
    expect(statusFromStripe('active')).toBe('ACTIVE');
    expect(statusFromStripe('trialing')).toBe('TRIALING');
    expect(statusFromStripe('past_due')).toBe('PAST_DUE');
    expect(statusFromStripe('unpaid')).toBe('CANCELED');
    expect(statusFromStripe('incomplete')).toBe('NONE');
  });
});
