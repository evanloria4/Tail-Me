import { describe, expect, it } from 'vitest';
import {
  groupResultTitle,
  newSlipTitle,
  NOTIFY_DEFAULTS,
  notifyPrefs,
  notifyPrefsSchema,
  resultTitle,
  slipLine,
  tailedResultTitle,
  unitsLabel,
} from './notifications';
import type { NoticeLeg } from './notifications';

const spread: NoticeLeg = {
  marketKey: 'spreads',
  selection: 'Chiefs',
  line: -3.5,
  playerName: null,
  marketLabel: null,
};
const prop: NoticeLeg = {
  marketKey: 'player_prop',
  selection: 'Over',
  line: 1.5,
  playerName: 'Patrick Mahomes',
  marketLabel: 'Passing TDs',
};

describe('notifyPrefs', () => {
  it('fills in defaults, with reactions off', () => {
    expect(notifyPrefs({})).toEqual(NOTIFY_DEFAULTS);
    expect(notifyPrefs(null).reactions).toBe(false);
  });

  it('keeps stored switches and ignores junk', () => {
    const prefs = notifyPrefs({
      slips: false,
      reactions: true,
      bogus: true,
      tails: 'no',
    });
    expect(prefs.slips).toBe(false);
    expect(prefs.reactions).toBe(true);
    expect(prefs.tails).toBe(true);
    expect(prefs).not.toHaveProperty('bogus');
  });

  it('only accepts known switches', () => {
    expect(notifyPrefsSchema.safeParse({ slips: false }).success).toBe(true);
    expect(notifyPrefsSchema.safeParse({ nope: true }).success).toBe(false);
    expect(notifyPrefsSchema.safeParse({ slips: 'yes' }).success).toBe(false);
  });
});

describe('newSlipTitle', () => {
  it('names the series a slip is filed under', () => {
    expect(newSlipTitle('Charlie', 'LADDER', 'CharLadder')).toBe(
      'Charlie posted the CharLadder'
    );
  });

  it('falls back to the slip type', () => {
    expect(newSlipTitle('Charlie', 'PARLAY', null)).toBe(
      'Charlie posted a parlay'
    );
  });
});

describe('slipLine', () => {
  it('describes a straight with its price', () => {
    expect(slipLine('STRAIGHT', [{ americanOdds: -110, legs: [spread] }])).toBe(
      'Chiefs -3.5 (-110)'
    );
  });

  it('sums up a parlay without its legs', () => {
    expect(
      slipLine('PARLAY', [{ americanOdds: 596, legs: [spread, prop] }])
    ).toBe('2-leg parlay +596');
  });

  it('counts ladder rungs', () => {
    const rung = { americanOdds: 200, legs: [prop] };
    expect(slipLine('LADDER', [rung, rung, rung])).toBe(
      'Patrick Mahomes Passing TDs · 3-rung ladder'
    );
  });
});

describe('result titles', () => {
  it('signs units', () => {
    expect(unitsLabel(2.456)).toBe('+2.46u');
    expect(unitsLabel(-1)).toBe('-1u');
    expect(unitsLabel(0)).toBe('0u');
  });

  it('tells the poster how it went', () => {
    expect(resultTitle('PARLAY', [{ result: 'WON' }], 4.2)).toBe(
      '✅ Your parlay hit! +4.2u'
    );
    expect(resultTitle('STRAIGHT', [{ result: 'LOST' }], -1)).toBe(
      '❌ Your straight lost · -1u'
    );
    expect(
      resultTitle(
        'LADDER',
        [{ result: 'WON' }, { result: 'LOST' }, { result: 'VOID' }],
        0.5
      )
    ).toBe('Your ladder finished 1/2 · +0.5u');
  });

  it('tells tailers whose slip it was', () => {
    expect(tailedResultTitle('Sam', 'PARLAY', [{ result: 'WON' }])).toBe(
      "✅ Sam's parlay you tailed hit!"
    );
  });

  it('tells a group parlay the price it hit at', () => {
    expect(groupResultTitle('WON', 1200)).toBe(
      '🎉 The group parlay hit at +1200!'
    );
    expect(groupResultTitle('LOST', 1200)).toBe('💀 The group parlay busted');
  });
});
