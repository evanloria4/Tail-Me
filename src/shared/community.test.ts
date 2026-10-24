import { describe, expect, it } from 'vitest';
import { dailyTotals, daySuperlatives, gameDay } from './community';
import type { TodayBet } from './community';

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

describe('daySuperlatives', () => {
  const ann = {
    id: 'a',
    username: 'ann',
    fullName: 'Ann A',
    avatarUrl: null,
    avatarColor: 'emerald',
  };
  const bo = {
    id: 'b',
    username: 'bo',
    fullName: 'Bo B',
    avatarUrl: null,
    avatarColor: 'sky',
  };
  const bet = (over: Partial<TodayBet>): TodayBet => ({
    authorId: 'a',
    units: 1,
    americanOdds: 100,
    decimalOdds: 2,
    result: 'WON',
    legs: ['WON'],
    ...over,
  });

  it('picks the longest hit, the best and worst nets, and a one-leg beat', () => {
    const cards = daySuperlatives(
      [ann, bo],
      [
        bet({ americanOdds: 450, decimalOdds: 5.5 }),
        bet({
          authorId: 'b',
          result: 'LOST',
          units: 2,
          legs: ['WON', 'WON', 'LOST'],
          americanOdds: 600,
        }),
      ]
    );
    expect(cards.map((c) => [c.key, c.person.id, c.value])).toEqual([
      ['biggest', 'a', '+450'],
      ['topEarner', 'a', '+4.50u'],
      ['worstBeat', 'b', '+600'],
      ['roughDay', 'b', '-2.00u'],
    ]);
  });

  it('says what $10 paid on the biggest hit', () => {
    const [card] = daySuperlatives(
      [ann],
      [bet({ americanOdds: 199, decimalOdds: 2.99 })]
    );
    expect(card.detail).toBe('$10 paid $30');
  });

  it('shows nothing before anything settles today', () => {
    expect(daySuperlatives([ann], [])).toEqual([]);
  });
});

describe('gameDay', () => {
  const posted = new Date('2026-10-20T15:00:00Z');

  it('is the Central day of the last game, not when it settled', () => {
    // 9:30 PM CT Friday kickoff: still Friday, though it's graded after midnight
    expect(gameDay([new Date('2026-10-24T02:30:00Z')], posted)).toBe(
      '2026-10-23'
    );
  });

  it('takes the latest game on a parlay that spans days', () => {
    expect(
      gameDay(
        [new Date('2026-10-23T23:00:00Z'), new Date('2026-10-25T17:00:00Z')],
        posted
      )
    ).toBe('2026-10-25');
  });

  it('falls back to the post day with no game attached', () => {
    expect(gameDay([null], posted)).toBe('2026-10-20');
  });
});
