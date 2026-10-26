import { describe, expect, it } from 'vitest';
import {
  betPrice,
  boostDecimal,
  americanToDecimal,
  decimalToAmerican,
  formatAmerican,
  formatMoney,
  isValidAmerican,
  parlayDecimal,
  payout,
} from './odds';

describe('isValidAmerican', () => {
  it.each([100, -100, 150, -110, 2500])('accepts %i', (o) => {
    expect(isValidAmerican(o)).toBe(true);
  });
  it.each([0, 50, -99, 1.5, NaN])('rejects %s', (o) => {
    expect(isValidAmerican(o)).toBe(false);
  });
});

describe('americanToDecimal', () => {
  it('converts plus odds', () => {
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(100)).toBe(2);
  });
  it('converts minus odds', () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.9091, 4);
    expect(americanToDecimal(-200)).toBe(1.5);
  });
});

describe('decimalToAmerican', () => {
  it('round-trips common prices', () => {
    [-300, -110, 100, 150, 1332].forEach((o) => {
      expect(decimalToAmerican(americanToDecimal(o))).toBe(o);
    });
  });
  it('treats even money as +100', () => {
    expect(decimalToAmerican(2)).toBe(100);
  });
  it('rejects decimal odds <= 1', () => {
    expect(() => decimalToAmerican(1)).toThrow();
  });
});

describe('parlayDecimal', () => {
  it('multiplies leg prices', () => {
    // 2.5 * 1.9091 * 3 = 14.318 -> +1332
    const d = parlayDecimal([150, -110, 200]);
    expect(d).toBeCloseTo(14.3182, 4);
    expect(decimalToAmerican(d)).toBe(1332);
  });
  it('two -110 legs is about +264', () => {
    expect(decimalToAmerican(parlayDecimal([-110, -110]))).toBe(264);
  });
});

describe('payout', () => {
  it('includes the stake and rounds to cents', () => {
    expect(payout(10, 2.5)).toBe(25);
    expect(payout(10, americanToDecimal(-110))).toBe(19.09);
    expect(payout(10, parlayDecimal([150, -110, 200]))).toBe(143.18);
  });
});

describe('formatting', () => {
  it('signs American odds', () => {
    expect(formatAmerican(150)).toBe('+150');
    expect(formatAmerican(-110)).toBe('-110');
  });
  it('formats money', () => {
    expect(formatMoney(143.18)).toBe('$143.18');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
});

describe('profit boosts', () => {
  it('boosts the winnings, not the stake', () => {
    // +200 pays 2 on 1; 25% more winnings is 2.5
    expect(boostDecimal(3, 25)).toBeCloseTo(3.5);
    // -110 at 50%: winnings 0.909 -> 1.364
    expect(boostDecimal(americanToDecimal(-110), 50)).toBeCloseTo(2.3636, 3);
  });

  it('stores the boosted price and the regular odds', () => {
    expect(betPrice({ americanOdds: 200, decimalOdds: 3 }, 25)).toEqual({
      americanOdds: 250,
      decimalOdds: 3.5,
      boostPct: 25,
      regularOdds: 200,
    });
  });

  it('turns a short favorite plus money once boosted enough', () => {
    expect(
      betPrice({ americanOdds: -110, decimalOdds: americanToDecimal(-110) }, 50)
        .americanOdds
    ).toBe(136);
  });

  it('no boost (or 0) keeps the regular price', () => {
    const regular = { americanOdds: -110, decimalOdds: 1.9091 };
    expect(betPrice(regular, 0)).toEqual({
      ...regular,
      boostPct: null,
      regularOdds: null,
    });
    expect(betPrice(regular, null).boostPct).toBeNull();
  });
});
