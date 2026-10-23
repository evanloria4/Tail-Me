import { describe, expect, it } from 'vitest';
import {
  BetResult,
  canBeFaded,
  canAddRung,
  canEditSlip,
  LADDER_MAX_RUNGS,
  nextRung,
  createPostSchema,
  deleteRule,
  describeLeg,
  editPostSchema,
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

  it('never blocks an admin, but settled slips still only hide', () => {
    expect(deleteRule(slip(['PENDING'], 600), now, true)).toBe('remove');
    expect(deleteRule(slip(['LOST'], 600), now, true)).toBe('hide');
  });
});

describe('canBeFaded', () => {
  it('fades two-sided straights only', () => {
    expect(canBeFaded('STRAIGHT', [leg])).toBe(true);
    expect(canBeFaded('PARLAY', [leg, leg])).toBe(false);
    expect(canBeFaded('LADDER', [leg])).toBe(false);
    expect(canBeFaded('GROUP_PARLAY', [leg])).toBe(false);
  });

  it('skips one-sided scorer props, stored as player_prop + Yes', () => {
    expect(
      canBeFaded('STRAIGHT', [{ marketKey: 'player_prop', selection: 'Yes' }])
    ).toBe(false);
    expect(
      canBeFaded('STRAIGHT', [{ marketKey: 'player_prop', selection: 'Over' }])
    ).toBe(true);
  });
});

describe('canEditSlip', () => {
  const now = new Date('2026-10-25T17:00:00Z');
  const slip = (
    type: 'STRAIGHT' | 'PARLAY' | 'LADDER' | 'GROUP_PARLAY',
    starts: (string | null)[],
    result: BetResult = 'PENDING'
  ) => ({
    type,
    bets: [
      {
        result,
        legs: starts.map((startsAt) => ({
          result: 'PENDING' as BetResult,
          startsAt,
        })),
      },
    ],
  });

  it('allows straights and parlays before any game starts', () => {
    expect(canEditSlip(slip('STRAIGHT', ['2026-10-25T18:00:00Z']), now)).toBe(
      true
    );
    expect(
      canEditSlip(
        slip('PARLAY', ['2026-10-25T18:00:00Z', '2026-10-26T00:20:00Z']),
        now
      )
    ).toBe(true);
  });

  it('locks once any game on it starts', () => {
    expect(
      canEditSlip(
        slip('PARLAY', ['2026-10-25T17:00:00Z', '2026-10-26T00:20:00Z']),
        now
      )
    ).toBe(false);
  });

  it('never edits ladders, group parlays or graded slips', () => {
    const later = ['2026-10-25T18:00:00Z'];
    expect(canEditSlip(slip('LADDER', later), now)).toBe(false);
    expect(canEditSlip(slip('GROUP_PARLAY', later), now)).toBe(false);
    expect(canEditSlip(slip('STRAIGHT', later, 'VOID'), now)).toBe(false);
  });

  it('lets admins edit past kickoff, but not graded slips or ladders', () => {
    const started = ['2026-10-25T16:00:00Z'];
    expect(canEditSlip(slip('STRAIGHT', started), now, true)).toBe(true);
    expect(canEditSlip(slip('STRAIGHT', started, 'WON'), now, true)).toBe(
      false
    );
    expect(canEditSlip(slip('LADDER', started), now, true)).toBe(false);
  });
});

describe('canAddRung', () => {
  const now = new Date('2026-10-25T17:00:00Z');
  const ladder = (
    starts: string,
    result: BetResult = 'PENDING',
    rungs = 2
  ) => ({
    type: 'LADDER' as const,
    bets: Array.from({ length: rungs }, () => ({
      result,
      legs: [{ result, startsAt: starts }],
    })),
  });
  const later = '2026-10-25T18:00:00Z';
  const started = '2026-10-25T16:00:00Z';

  it('lets the author add pregame only', () => {
    expect(canAddRung(ladder(later), now)).toBe(true);
    expect(canAddRung(ladder(started), now)).toBe(false);
    expect(canAddRung(ladder(later, 'WON'), now)).toBe(false);
  });

  it('lets admins add any time, up to the rung limit', () => {
    expect(canAddRung(ladder(started, 'LOST'), now, true)).toBe(true);
    expect(
      canAddRung(ladder(later, 'PENDING', LADDER_MAX_RUNGS), now, true)
    ).toBe(false);
  });

  it('is only for ladders', () => {
    expect(canAddRung({ ...ladder(later), type: 'PARLAY' }, now, true)).toBe(
      false
    );
  });
});

describe('nextRung', () => {
  it('steps past the longest price', () => {
    // Overs climb up
    expect(
      nextRung([
        { line: 174.5, americanOdds: -210, units: 2 },
        { line: 199.5, americanOdds: 110, units: 1 },
      ])
    ).toEqual({ line: 224.5, step: 25, units: 1 });
    // Unders climb down
    expect(
      nextRung([
        { line: 44.5, americanOdds: -110, units: 1 },
        { line: 40.5, americanOdds: 160, units: 0.5 },
      ])
    ).toEqual({ line: 36.5, step: 4, units: 0.5 });
  });
});

describe('editPostSchema', () => {
  const edit = (keepLegIds: string[], legs: unknown[]) =>
    editPostSchema.safeParse({ units: 1, keepLegIds, legs });

  it('needs at least one pick left', () => {
    expect(edit([], []).success).toBe(false);
    expect(edit(['a'], []).success).toBe(true);
    expect(edit([], [leg]).success).toBe(true);
  });

  it('caps a slip at 20 legs', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `l${i}`);
    expect(edit(ids, []).success).toBe(true);
    expect(edit(ids, [leg]).success).toBe(false);
  });
});
