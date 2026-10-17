import { describe, expect, it } from 'vitest';
import { dailyTotals, dayKey, isTimeZone } from './community';

describe('dayKey', () => {
  it('buckets by the viewer’s time zone', () => {
    // 1am UTC on the 17th is still the 16th in New York
    const late = new Date('2026-10-17T01:00:00Z');
    expect(dayKey(late, 'America/New_York')).toBe('2026-10-16');
    expect(dayKey(late, 'UTC')).toBe('2026-10-17');
  });

  it('falls back to UTC for a bad zone', () => {
    expect(dayKey(new Date('2026-10-17T01:00:00Z'), 'Not/AZone')).toBe(
      '2026-10-17'
    );
    expect(isTimeZone('Not/AZone')).toBe(false);
    expect(isTimeZone('America/Chicago')).toBe(true);
  });
});

describe('dailyTotals', () => {
  it('sums settled bets per day, skipping pending and void', () => {
    const at = (iso: string) => new Date(iso);
    expect(
      dailyTotals(
        [
          {
            createdAt: at('2026-10-15T18:00:00Z'),
            units: 1,
            decimalOdds: 2,
            result: 'WON',
          },
          {
            createdAt: at('2026-10-15T20:00:00Z'),
            units: 2,
            decimalOdds: 2,
            result: 'LOST',
          },
          {
            createdAt: at('2026-10-14T18:00:00Z'),
            units: 1,
            decimalOdds: 3,
            result: 'WON',
          },
          {
            createdAt: at('2026-10-14T18:00:00Z'),
            units: 9,
            decimalOdds: 3,
            result: 'PENDING',
          },
          {
            createdAt: at('2026-10-13T18:00:00Z'),
            units: 9,
            decimalOdds: 3,
            result: 'VOID',
          },
        ],
        'UTC'
      )
    ).toEqual([
      { day: '2026-10-14', net: 2, bets: 1 },
      { day: '2026-10-15', net: -1, bets: 2 },
    ]);
  });
});
