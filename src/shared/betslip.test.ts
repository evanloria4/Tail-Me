import { describe, expect, it } from 'vitest';
import combinedSlipLink from './betslip';

const fd = (market: string, selection: string) =>
  `https://sportsbook.fanduel.com/addToBetslip?marketId=${market}&selectionId=${selection}`;

describe('combinedSlipLink', () => {
  it('stacks FanDuel picks into one indexed link', () => {
    expect(
      combinedSlipLink([
        fd('42.616149652', '50194'),
        fd('42.578347319', '50196'),
      ])
    ).toBe(
      'https://sportsbook.fanduel.com/addToBetslip?marketId[0]=42.616149652&selectionId[0]=50194&marketId[1]=42.578347319&selectionId[1]=50196'
    );
  });

  it('needs two or more picks', () => {
    expect(combinedSlipLink([fd('42.1', '5')])).toBeNull();
  });

  it('gives up if any pick has no usable link', () => {
    expect(combinedSlipLink([fd('42.1', '5'), null])).toBeNull();
    expect(
      combinedSlipLink([
        fd('42.1', '5'),
        'https://sportsbook.draftkings.com/?outcomes=0QA1',
      ])
    ).toBeNull();
    expect(combinedSlipLink([fd('42.1', '5'), 'not a url'])).toBeNull();
  });
});
