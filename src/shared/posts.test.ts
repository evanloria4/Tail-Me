import { describe, expect, it } from 'vitest';
import {
  BetResult,
  createPostSchema,
  deleteRule,
  describeLeg,
  groupResult,
  hasBookPrice,
  isGroupLocked,
  isSameGameLegs,
} from './posts';

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

describe('groupResult', () => {
  it('sinks on any lost leg, even with others open', () => {
    expect(groupResult(['WON', 'LOST', 'PENDING'])).toBe('LOST');
  });
  it('stays pending while a leg is open', () => {
    expect(groupResult(['WON', 'PENDING'])).toBe('PENDING');
  });
  it('wins past pushes and voids', () => {
    expect(groupResult(['WON', 'PUSH', 'VOID'])).toBe('WON');
  });
  it('pushes when every live leg pushed, voids when all voided', () => {
    expect(groupResult(['PUSH', 'VOID'])).toBe('PUSH');
    expect(groupResult(['VOID', 'VOID'])).toBe('VOID');
  });
});

describe('isGroupLocked', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  it('locks at the deadline or when the creator locks it', () => {
    expect(
      isGroupLocked({ lockAt: '2026-10-17T13:00:00Z', lockedAt: null }, now)
    ).toBe(false);
    expect(
      isGroupLocked({ lockAt: '2026-10-17T12:00:00Z', lockedAt: null }, now)
    ).toBe(true);
    expect(
      isGroupLocked(
        { lockAt: '2026-10-17T13:00:00Z', lockedAt: '2026-10-17T11:00:00Z' },
        now
      )
    ).toBe(true);
  });
});

describe('createPostSchema group parlays', () => {
  it('needs an ISO deadline and one leg', () => {
    expect(
      createPostSchema.safeParse({
        type: 'GROUP_PARLAY',
        sportsbookKey: 'fanduel',
        lockAt: '2026-10-18T00:00:00.000Z',
        leg,
      }).success
    ).toBe(true);
    expect(
      createPostSchema.safeParse({
        type: 'GROUP_PARLAY',
        sportsbookKey: 'fanduel',
        lockAt: 'tomorrow',
        leg,
      }).success
    ).toBe(false);
  });
});

describe('hasBookPrice', () => {
  const legs = [{ americanOdds: 120 }, { americanOdds: -110 }];
  it('is false at the legs multiplied, true at any other price', () => {
    // 2.2 x 1.909 = 4.2 -> +320
    expect(hasBookPrice({ americanOdds: 320, legs })).toBe(false);
    expect(hasBookPrice({ americanOdds: 275, legs })).toBe(true);
  });
});

describe('isSameGameLegs', () => {
  it('needs 2+ legs from one game', () => {
    const a = { eventLabel: 'Bills @ Chiefs' };
    expect(isSameGameLegs([a, a])).toBe(true);
    expect(isSameGameLegs([a])).toBe(false);
    expect(isSameGameLegs([a, { eventLabel: 'Jets @ Pats' }])).toBe(false);
  });
});

describe('deleteRule', () => {
  const now = new Date('2026-10-17T18:00:00Z');
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const slip = (
    results: BetResult[],
    postedMinsAgo: number,
    extra: Partial<Parameters<typeof deleteRule>[0]> = {}
  ) => ({
    createdAt: minsAgo(postedMinsAgo),
    type: 'STRAIGHT' as const,
    group: null,
    bets: results.map((result) => ({ result })),
    ...extra,
  });

  it('hides settled slips, which keep counting', () => {
    expect(deleteRule(slip(['LOST'], 600), now)).toBe('hide');
    expect(deleteRule(slip(['WON', 'LOST'], 1), now)).toBe('hide');
  });

  it('removes an unsettled slip posted by mistake, blocks it after', () => {
    expect(deleteRule(slip(['PENDING'], 5), now)).toBe('remove');
    expect(deleteRule(slip(['PENDING'], 20), now)).toBe('blocked');
    // A ladder with one open rung is still unsettled
    expect(deleteRule(slip(['WON', 'PENDING'], 60), now)).toBe('blocked');
  });

  it('removes a group parlay freely until it locks', () => {
    const open = { lockAt: new Date(now.getTime() + 3600e3), lockedAt: null };
    const locked = { lockAt: minsAgo(30), lockedAt: null };
    expect(
      deleteRule(
        slip(['PENDING'], 600, { type: 'GROUP_PARLAY', group: open }),
        now
      )
    ).toBe('remove');
    expect(
      deleteRule(
        slip(['PENDING'], 600, { type: 'GROUP_PARLAY', group: locked }),
        now
      )
    ).toBe('blocked');
  });
});
