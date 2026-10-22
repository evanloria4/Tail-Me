import { describe, expect, it } from 'vitest';
import { isHot, slipBadges, slipTier, tierFor } from './badges';
import type { BetResult, FeedBet, FeedPost } from './posts';

function post(
  type: FeedPost['type'],
  bets: { result: BetResult; odds?: number; tails?: number }[]
): FeedPost {
  return {
    id: 'p',
    type,
    caption: null,
    createdAt: '2026-10-16T00:00:00Z',
    author: {
      id: 'u',
      username: 'u',
      fullName: 'U',
      avatarUrl: null,
      streak: null,
    },
    sportsbook: { key: 'fanduel', name: 'FanDuel' },
    reactions: [],
    group: null,
    series: null,
    commentCount: 0,
    tailers: { count: 0, recent: [] },
    fadeCount: 0,
    fadedByMe: false,
    bets: bets.map(
      (b, i): FeedBet => ({
        id: `b${i}`,
        order: i,
        units: 1,
        americanOdds: b.odds ?? -110,
        decimalOdds: 2,
        result: b.result,
        deepLink: null,
        tailCount: b.tails ?? 0,
        tailedByMe: false,
        legs: [],
      })
    ),
  };
}

const kinds = (p: FeedPost) => slipBadges(p).map((b) => b.kind);

describe('isHot', () => {
  it('needs 3+ wins in a row', () => {
    expect(isHot({ kind: 'W', count: 3 })).toBe(true);
    expect(isHot({ kind: 'W', count: 2 })).toBe(false);
    expect(isHot({ kind: 'L', count: 5 })).toBe(false);
    expect(isHot(null)).toBe(false);
  });
});

describe('slipBadges', () => {
  it('flags wins at +200 or longer only once they hit', () => {
    expect(slipBadges(post('PARLAY', [{ result: 'WON', odds: 650 }]))).toEqual([
      { kind: 'WIN', tier: 2, odds: 650, decimal: 2 },
    ]);
    expect(kinds(post('PARLAY', [{ result: 'PENDING', odds: 650 }]))).toEqual(
      []
    );
    expect(kinds(post('STRAIGHT', [{ result: 'WON', odds: 150 }]))).toEqual([]);
  });

  it('uses the longest winning rung on a ladder', () => {
    const ladder = post('LADDER', [
      { result: 'WON', odds: 150 },
      { result: 'WON', odds: 500 },
      { result: 'LOST', odds: 900 },
    ]);
    expect(slipBadges(ladder)).toEqual([
      { kind: 'WIN', tier: 2, odds: 500, decimal: 2 },
    ]);
  });

  it('marks a clean ladder sweep, ignoring voided rungs', () => {
    expect(
      kinds(
        post('LADDER', [
          { result: 'WON' },
          { result: 'VOID' },
          { result: 'WON' },
        ])
      )
    ).toEqual(['SWEEP']);
    expect(
      kinds(post('LADDER', [{ result: 'WON' }, { result: 'PENDING' }]))
    ).toEqual([]);
  });

  it('marks group locks by tail count', () => {
    expect(
      slipBadges(post('STRAIGHT', [{ result: 'PENDING', tails: 4 }]))
    ).toEqual([{ kind: 'POPULAR', tails: 4 }]);
    expect(kinds(post('STRAIGHT', [{ result: 'PENDING', tails: 2 }]))).toEqual(
      []
    );
  });
});

describe('win tiers', () => {
  it('steps up at +200, +400, +900 and +2400', () => {
    expect(tierFor(199)).toBeNull();
    expect(tierFor(200)).toBe(1);
    expect(tierFor(399)).toBe(1);
    expect(tierFor(400)).toBe(2);
    expect(tierFor(900)).toBe(3);
    expect(tierFor(2400)).toBe(4);
    expect(tierFor(15000)).toBe(4);
  });

  it('lifts a clean ladder sweep to at least Cashed', () => {
    const sweep = post('LADDER', [
      { result: 'WON', odds: -200 },
      { result: 'WON', odds: 120 },
    ]);
    expect(slipTier(slipBadges(sweep))).toBe(2);
    const bigSweep = post('LADDER', [
      { result: 'WON', odds: 300 },
      { result: 'WON', odds: 1000 },
    ]);
    expect(slipTier(slipBadges(bigSweep))).toBe(3);
    expect(slipTier([])).toBeNull();
  });
});
