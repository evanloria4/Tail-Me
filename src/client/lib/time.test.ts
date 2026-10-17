import { describe, expect, it } from 'vitest';
import { lockTime } from './time';

describe('lockTime', () => {
  // Noon Central on Sat Oct 17, 2026 (CDT, UTC-5); results read the same
  // whatever zone the test machine is in
  const now = new Date('2026-10-17T12:00:00-05:00');
  const ct = (iso: string) => `${iso}-05:00`;

  it('names today, tomorrow and yesterday in Central', () => {
    expect(lockTime(ct('2026-10-17T19:30:00'), now)).toBe('Today 7:30 PM CT');
    expect(lockTime(ct('2026-10-18T13:00:00'), now)).toBe(
      'Tomorrow 1:00 PM CT'
    );
    expect(lockTime(ct('2026-10-16T09:00:00'), now)).toBe(
      'Yesterday 9:00 AM CT'
    );
  });

  it('uses the weekday within a week, then the date', () => {
    expect(lockTime(ct('2026-10-20T13:00:00'), now)).toBe('Tue 1:00 PM CT');
    expect(lockTime(ct('2026-10-28T13:00:00'), now)).toBe('Oct 28, 1:00 PM CT');
  });

  it('counts days in Central, not UTC', () => {
    // 11pm Central is already tomorrow in UTC, but still "Today" here
    expect(lockTime(ct('2026-10-17T23:00:00'), now)).toBe('Today 11:00 PM CT');
  });
});
