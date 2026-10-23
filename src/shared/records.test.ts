import { describe, expect, it } from 'vitest';
import { groupRow, leaderRow, recordsPage, superlatives } from './records';
import type { RecordBet, RecordGroupParlay } from './records';
import type { BetResult } from './posts';

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
  avatarColor: 'emerald',
};

let seq = 0;
function bet(over: Partial<RecordBet> & { result: BetResult }): RecordBet {
  seq += 1;
  return {
    type: 'STRAIGHT',
    sportKey: 'americanfootball_nfl',
    createdAt: new Date(Date.UTC(2026, 9, 1, 18) + seq * 60_000),
    order: 0,
    units: 1,
    decimalOdds: 2,
    americanOdds: 100,
    authorId: 'a',
    postId: `p${seq}`,
    tails: 0,
    fades: 0,
    legs: [over.result],
    ...over,
  };
}

describe('leaderRow', () => {
  it('shows the last 5 settled bets newest first, skipping voids and pending', () => {
    const bets = [
      bet({ result: 'WON' }),
      bet({ result: 'LOST' }),
      bet({ result: 'WON' }),
      bet({ result: 'VOID' }),
      bet({ result: 'PUSH' }),
      bet({ result: 'LOST' }),
      bet({ result: 'WON' }),
      bet({ result: 'PENDING' }),
    ];
    expect(leaderRow(ann, bets, null).l5).toEqual([
      'WON',
      'LOST',
      'PUSH',
      'WON',
      'LOST',
    ]);
  });

  it('keeps L5 and the streak all-time but the record in range', () => {
    const old = bet({
      result: 'WON',
      createdAt: new Date(Date.UTC(2026, 0, 1)),
    });
    const recent = bet({ result: 'WON' });
    const row = leaderRow(ann, [old, recent], new Date(Date.UTC(2026, 8, 1)));
    expect(row.line.wins).toBe(1);
    expect(row.l5).toEqual(['WON', 'WON']);
    expect(row.streak).toEqual({ kind: 'W', count: 2 });
  });

  it('scores fades from the faders’ side, once per fader', () => {
    const row = leaderRow(
      ann,
      [
        bet({ result: 'LOST', fades: 2 }),
        bet({ result: 'WON', fades: 1 }),
        bet({ result: 'PENDING', fades: 3 }),
      ],
      null
    );
    expect(row.faded).toEqual({ wins: 2, losses: 1, pushes: 0 });
  });
});

describe('groupRow', () => {
  const parlay = (
    result: BetResult,
    legs: [string, BetResult][],
    day: number
  ): RecordGroupParlay => ({
    postId: `g${day}`,
    createdAt: new Date(Date.UTC(2026, 9, day)),
    result,
    legs: legs.map(([addedById, r]) => ({ addedById, result: r })),
  });

  it('counts legs, only misses and cashes', () => {
    const row = groupRow(ann, [
      parlay(
        'LOST',
        [
          ['a', 'LOST'],
          ['b', 'WON'],
        ],
        1
      ),
      parlay(
        'LOST',
        [
          ['a', 'LOST'],
          ['b', 'LOST'],
        ],
        2
      ),
      parlay(
        'WON',
        [
          ['a', 'WON'],
          ['b', 'WON'],
        ],
        3
      ),
      parlay(
        'PENDING',
        [
          ['a', 'PENDING'],
          ['b', 'WON'],
        ],
        4
      ),
      parlay(
        'WON',
        [
          ['b', 'WON'],
          ['c', 'WON'],
        ],
        5
      ),
    ]);
    expect(row).toMatchObject({
      parlays: 4,
      hit: 1,
      busted: 2,
      pending: 1,
      onlyMiss: 1,
      cashed: 1,
      l5: ['WON', 'LOST', 'LOST'],
    });
  });
});

describe('superlatives', () => {
  it('finds the biggest hit and a one-leg worst beat', () => {
    const bets = [
      bet({ result: 'WON', americanOdds: 450, decimalOdds: 5.5 }),
      bet({
        authorId: 'b',
        type: 'PARLAY',
        result: 'LOST',
        americanOdds: 900,
        legs: ['WON', 'WON', 'LOST'],
      }),
      // Lost by two legs: not a "beat"
      bet({
        authorId: 'b',
        type: 'PARLAY',
        result: 'LOST',
        americanOdds: 2000,
        legs: ['WON', 'LOST', 'LOST'],
      }),
    ];
    const cards = superlatives([ann, bo], bets, []);
    expect(cards.find((c) => c.key === 'biggest')).toMatchObject({
      person: ann,
      value: '+450',
      detail: '$10 paid $55',
    });
    expect(cards.find((c) => c.key === 'worstBeat')).toMatchObject({
      person: bo,
      value: '+900',
      detail: '2/3 legs hit',
    });
  });

  it('leaves out cards nobody qualifies for', () => {
    expect(superlatives([ann], [bet({ result: 'LOST' })], [])).toEqual([]);
  });
});

describe('recordsPage', () => {
  it('sorts the leaderboard by units and keeps group parlays apart', () => {
    const page = recordsPage(
      'all',
      null,
      [ann, bo],
      [
        bet({ authorId: 'a', result: 'LOST' }),
        bet({ authorId: 'b', result: 'WON' }),
      ],
      [
        {
          postId: 'g',
          createdAt: new Date(),
          result: 'WON',
          legs: [{ addedById: 'a', result: 'WON' }],
        },
      ]
    );
    expect(page.leaderboard.map((r) => r.id)).toEqual(['b', 'a']);
    expect(page.group).toMatchObject({ wins: 1, losses: 0 });
    expect(page.group.people.map((r) => r.id)).toEqual(['a']);
  });
});
