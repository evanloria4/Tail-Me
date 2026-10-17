import { describe, expect, it } from 'vitest';
import { lockTime } from './time';

describe('lockTime', () => {
  // Local times, so the test reads the same in any zone
  const now = new Date(2026, 9, 17, 12, 0);
  const at = (d: number, h: number, m = 0) =>
    new Date(2026, 9, d, h, m).toISOString();

  it('names today, tomorrow and yesterday', () => {
    expect(lockTime(at(17, 19, 30), now)).toBe('Today 7:30 PM');
    expect(lockTime(at(18, 13), now)).toBe('Tomorrow 1:00 PM');
    expect(lockTime(at(16, 9), now)).toBe('Yesterday 9:00 AM');
  });

  it('uses the weekday within a week, then the date', () => {
    expect(lockTime(at(20, 13), now)).toBe('Tue 1:00 PM');
    expect(lockTime(at(28, 13), now)).toBe('Oct 28, 1:00 PM');
  });
});
