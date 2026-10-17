import { describe, expect, it } from 'vitest';
import { fromSiteInput, siteDayDiff, siteDayKey, toSiteInput } from './time';

describe('Central time helpers', () => {
  it('reads instants as Central wall-clock time', () => {
    // 1am UTC on the 17th is 8pm on the 16th in Chicago (CDT, UTC-5)
    const late = new Date('2026-10-17T01:00:00Z');
    expect(siteDayKey(late)).toBe('2026-10-16');
    expect(toSiteInput(late)).toBe('2026-10-16T20:00');
  });

  it('turns a typed Central time into the right instant, DST or not', () => {
    // July is CDT (UTC-5), December is CST (UTC-6)
    expect(fromSiteInput('2026-07-04T13:00')?.toISOString()).toBe(
      '2026-07-04T18:00:00.000Z'
    );
    expect(fromSiteInput('2026-12-25T13:00')?.toISOString()).toBe(
      '2026-12-25T19:00:00.000Z'
    );
    // The day after DST ends (Nov 1, 2026)
    expect(fromSiteInput('2026-11-02T09:30')?.toISOString()).toBe(
      '2026-11-02T15:30:00.000Z'
    );
    expect(fromSiteInput('not a time')).toBeNull();
  });

  it('round-trips through the input format', () => {
    const at = new Date('2026-10-18T17:00:00Z');
    expect(fromSiteInput(toSiteInput(at))?.toISOString()).toBe(
      at.toISOString()
    );
  });

  it('counts calendar days in Central', () => {
    const now = new Date('2026-10-17T03:00:00Z'); // Oct 16, 10pm CT
    expect(siteDayDiff(new Date('2026-10-17T06:00:00Z'), now)).toBe(1);
    expect(siteDayDiff(new Date('2026-10-17T04:30:00Z'), now)).toBe(0);
  });
});
