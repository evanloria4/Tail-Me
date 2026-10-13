import { describe, expect, it } from 'vitest';
import { createPostSchema, describeLeg } from './posts';

const leg = {
  sportKey: 'americanfootball_nfl',
  eventLabel: 'Chiefs @ Bills',
  marketKey: 'spreads' as const,
  selection: 'Kansas City Chiefs',
  line: -3.5,
  americanOdds: -110,
};

const firstError = (input: unknown) => {
  const r = createPostSchema.safeParse(input);
  return r.success ? null : r.error.issues[0].message;
};

describe('createPostSchema', () => {
  it('accepts a straight bet', () => {
    expect(
      firstError({
        type: 'STRAIGHT',
        sportsbookKey: 'draftkings',
        units: 1,
        leg,
      })
    ).toBeNull();
  });

  it('requires a line on spreads and totals', () => {
    expect(
      firstError({
        type: 'STRAIGHT',
        sportsbookKey: 'draftkings',
        units: 1,
        leg: { ...leg, line: undefined },
      })
    ).toBe('Line is required');
  });

  it('requires player and prop type on player props', () => {
    expect(
      firstError({
        type: 'STRAIGHT',
        sportsbookKey: 'draftkings',
        units: 1,
        leg: { ...leg, marketKey: 'player_prop', selection: 'Over' },
      })
    ).toBe('Player is required');
  });

  it('rejects invalid odds', () => {
    expect(
      firstError({
        type: 'STRAIGHT',
        sportsbookKey: 'draftkings',
        units: 1,
        leg: { ...leg, americanOdds: 50 },
      })
    ).toMatch(/Odds must be/);
  });

  it('needs at least 2 parlay legs', () => {
    expect(
      firstError({
        type: 'PARLAY',
        sportsbookKey: 'fanduel',
        units: 1,
        legs: [leg],
      })
    ).toBe('A parlay needs at least 2 legs');
  });

  it('needs distinct ladder lines', () => {
    const { line, americanOdds, ...pick } = leg;
    expect(
      firstError({
        type: 'LADDER',
        sportsbookKey: 'draftkings',
        pick,
        rungs: [
          { line: 1.5, americanOdds: 150, units: 1 },
          { line: 1.5, americanOdds: 200, units: 1 },
        ],
      })
    ).toBe('Each rung needs a different line');
  });
});

describe('describeLeg', () => {
  const base = { playerName: null, marketLabel: null, line: null };
  it('formats each market', () => {
    expect(describeLeg({ ...base, marketKey: 'h2h', selection: 'Bills' })).toBe(
      'Bills ML'
    );
    expect(
      describeLeg({
        ...base,
        marketKey: 'spreads',
        selection: 'Bills',
        line: 3.5,
      })
    ).toBe('Bills +3.5');
    expect(
      describeLeg({
        ...base,
        marketKey: 'totals',
        selection: 'Over',
        line: 47.5,
      })
    ).toBe('Over 47.5');
    expect(
      describeLeg({
        marketKey: 'player_prop',
        selection: 'Over',
        line: 1.5,
        playerName: 'Patrick Mahomes',
        marketLabel: 'Passing TDs',
      })
    ).toBe('Patrick Mahomes Over 1.5 Passing TDs');
  });
});
