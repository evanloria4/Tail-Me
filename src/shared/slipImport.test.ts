import { describe, expect, it } from 'vitest';
import {
  outcomePick,
  parseFanduelLink,
  pickKey,
  rankGamesByMarketId,
} from './slipImport';

const ADD = 'https://sportsbook.fanduel.com/addToBetslip';

describe('parseFanduelLink', () => {
  it('reads a share code', () => {
    expect(parseFanduelLink(`${ADD}?shareCode=bVp6Zt3`)).toEqual({
      kind: 'share',
      shareCode: 'bVp6Zt3',
    });
  });

  it('finds the link inside a share message', () => {
    expect(
      parseFanduelLink(`Tail my parlay! ${ADD}?shareCode=bVp6Zt3 🔥`)
    ).toEqual({ kind: 'share', shareCode: 'bVp6Zt3' });
  });

  it('reads single and indexed add-to-betslip links', () => {
    expect(
      parseFanduelLink(`${ADD}?marketId=42.616149652&selectionId=50194`)
    ).toEqual({
      kind: 'picks',
      picks: [{ marketId: '42.616149652', selectionId: '50194' }],
    });
    expect(
      parseFanduelLink(
        `${ADD}?marketId[0]=42.1&selectionId[0]=5&marketId[1]=42.2&selectionId[1]=7`
      )
    ).toEqual({
      kind: 'picks',
      picks: [
        { marketId: '42.1', selectionId: '5' },
        { marketId: '42.2', selectionId: '7' },
      ],
    });
  });

  it('reads state subdomains', () => {
    expect(
      parseFanduelLink(
        'https://il.sportsbook.fanduel.com/addToBetslip?shareCode=abc123'
      )
    ).toEqual({ kind: 'share', shareCode: 'abc123' });
  });

  it('rejects other sites and links without picks', () => {
    expect(
      parseFanduelLink('https://evil.com/addToBetslip?shareCode=abc123')
    ).toBeNull();
    expect(
      parseFanduelLink(
        'https://sportsbook.fanduel.com.evil.com/?shareCode=abc123'
      )
    ).toBeNull();
    expect(parseFanduelLink(`${ADD}`)).toBeNull();
    expect(parseFanduelLink(`${ADD}?shareCode=../../x`)).toBeNull();
    expect(parseFanduelLink('not a link')).toBeNull();
  });
});

describe('outcomePick', () => {
  it('reads the pick from an outcome link', () => {
    const pick = outcomePick({
      name: 'Chicago Bears',
      price: -158,
      link: `${ADD}?marketId=42.616149652&selectionId=50204`,
      sid: '50204',
    });
    expect(pick && pickKey(pick)).toBe('42.616149652:50204');
  });

  it('is null without a link', () => {
    expect(outcomePick({ name: 'Over', price: -110 })).toBeNull();
  });
});

describe('rankGamesByMarketId', () => {
  it('puts the game whose markets sit nearest the picks first', () => {
    const games = [
      { id: 'early', marketIds: ['42.600000000'] },
      { id: 'near', marketIds: ['42.617500000', '42.617500003'] },
      { id: 'far', marketIds: ['42.700000000'] },
      { id: 'none', marketIds: [] },
    ];
    expect(
      rankGamesByMarketId(games, [
        { marketId: '42.617516464', selectionId: '1' },
      ])
    ).toEqual(['near', 'early', 'far']);
  });

  it('gives nothing to rank by without usable ids', () => {
    expect(rankGamesByMarketId([{ id: 'g', marketIds: ['42.1'] }], [])).toEqual(
      []
    );
  });
});
