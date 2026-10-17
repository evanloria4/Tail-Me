import { describe, expect, it } from 'vitest';
import { isHot, slipBadges } from './badges';
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
    commentCount: 0,
    bets: bets.map(
      (b, i): FeedBet => ({
        id: `b${i}`,
        order: i,
        units: 1,
        americanOdds: b.odds ?? -110,
        decimalOdds: 1.91,
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
  it('flags long-shot wins only once they hit', () => {
    expect(slipBadges(post('PARLAY', [{ result: 'WON', odds: 650 }]))).toEqual([
      { kind: 'BIG_WIN', odds: 650 },
    ]);
    expect(kinds(post('PARLAY', [{ result: 'PENDING', odds: 650 }]))).toEqual(
      []
    );
    expect(kinds(post('STRAIGHT', [{ result: 'WON', odds: 300 }]))).toEqual([]);
  });

  it('uses the longest winning rung on a ladder', () => {
    const ladder = post('LADDER', [
      { result: 'WON', odds: 150 },
      { result: 'WON', odds: 500 },
      { result: 'LOST', odds: 900 },
    ]);
    expect(slipBadges(ladder)).toEqual([{ kind: 'BIG_WIN', odds: 500 }]);
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

  it('marks crowd picks by tail count', () => {
    expect(
      slipBadges(post('STRAIGHT', [{ result: 'PENDING', tails: 4 }]))
    ).toEqual([{ kind: 'POPULAR', tails: 4 }]);
    expect(kinds(post('STRAIGHT', [{ result: 'PENDING', tails: 2 }]))).toEqual(
      []
    );
  });
});
