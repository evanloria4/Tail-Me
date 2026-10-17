import { describe, expect, it } from 'vitest';
import { dailyTotals } from './community';

describe('dailyTotals', () => {
  const at = (iso: string) => new Date(iso);

  it('sums settled bets per Central day, skipping pending and void', () => {
    expect(
      dailyTotals([
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
      ])
    ).toEqual([
      { day: '2026-10-14', net: 2, bets: 1 },
      { day: '2026-10-15', net: -1, bets: 2 },
    ]);
  });

  it('puts a late-night slip on its Central day', () => {
    // 1am UTC on the 17th is 8pm on the 16th in Chicago
    expect(
      dailyTotals([
        {
          createdAt: at('2026-10-17T01:00:00Z'),
          units: 1,
          decimalOdds: 2,
          result: 'WON',
        },
      ])[0].day
    ).toBe('2026-10-16');
  });
});
