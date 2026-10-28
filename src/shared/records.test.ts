import { describe, expect, it } from 'vitest';
import {
  groupRow,
  leaderRow,
  nearMisses,
  recordsPage,
  superlatives,
} from './records';
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
    tailers: [],
    fades: 0,
    legs: [over.result],
    seriesId: null,
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
    decimalOdds: 4,
    legs: legs.map(([addedById, r]) => ({
      addedById,
      result: r,
      americanOdds: 100,
    })),
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
      avgOdds: 100,
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

  it('names who made tailers the most, counting every tailer', () => {
    const cards = superlatives(
      [ann, bo],
      [
        // Ann: 2 tailers on a +1u winner = +2u
        bet({ result: 'WON', tails: 2 }),
        // Bo: 3 tailers on a 1u loser = -3u
        bet({ authorId: 'b', result: 'LOST', tails: 3 }),
      ],
      []
    );
    expect(cards.find((c) => c.key === 'bestToTail')).toMatchObject({
      person: ann,
      value: '+2.00u',
    });
  });

  it('names who made the most tailing others', () => {
    const cards = superlatives(
      [ann, bo],
      [
        // Bo tailed a +1u winner and a 1u loser of Ann's: net 0
        bet({ result: 'WON', tails: 1, tailers: ['b'] }),
        bet({ result: 'LOST', tails: 1, tailers: ['b'] }),
        // Ann tailed Bo's +2u winner
        bet({
          authorId: 'b',
          result: 'WON',
          units: 2,
          tails: 1,
          tailers: ['a'],
        }),
      ],
      []
    );
    expect(cards.find((c) => c.key === 'bestTailer')).toMatchObject({
      person: ann,
      value: '+2.00u',
    });
  });

  it('finds sweeps, cold runs and win-rate extremes, brags before roasts', () => {
    const ladder = (postId: string, results: BetResult[]) =>
      results.map((result, order) =>
        bet({ type: 'LADDER', postId, order, result })
      );
    const cards = superlatives(
      [ann, bo],
      [
        // Ann: a clean sweep and 8-2 overall (10 settled)
        ...ladder('l1', ['WON', 'WON']),
        ...Array.from({ length: 6 }, () => bet({ result: 'WON' })),
        bet({ result: 'LOST' }),
        bet({ result: 'LOST' }),
        // Bo: 3-7 with four losses in a row
        ...Array.from({ length: 3 }, () =>
          bet({ authorId: 'b', result: 'WON' })
        ),
        ...Array.from({ length: 7 }, () =>
          bet({ authorId: 'b', result: 'LOST' })
        ),
      ],
      []
    );
    const card = (key: string) => cards.find((c) => c.key === key);
    expect(card('ladderKing')).toMatchObject({ person: ann, value: '1' });
    expect(card('sharpest')).toMatchObject({ person: ann, value: '80%' });
    expect(card('fadeMaterial')).toMatchObject({ person: bo, value: '30%' });
    expect(card('coldest')).toMatchObject({ person: bo, value: 'L7' });
    const keys = cards.map((c) => c.key);
    expect(keys.indexOf('sharpest')).toBeLessThan(keys.indexOf('coldest'));
  });

  it('roasts the most goose eggs (parlays with every leg missed)', () => {
    const cards = superlatives(
      [ann, bo],
      [
        bet({
          authorId: 'b',
          type: 'PARLAY',
          result: 'LOST',
          legs: ['LOST', 'LOST'],
        }),
        bet({
          authorId: 'b',
          type: 'PARLAY',
          result: 'LOST',
          legs: ['LOST', 'LOST', 'LOST'],
        }),
        // Lost, but one leg hit: not a goose egg
        bet({ type: 'PARLAY', result: 'LOST', legs: ['WON', 'LOST'] }),
      ],
      []
    );
    expect(cards.find((c) => c.key === 'gooseEgg')).toMatchObject({
      person: bo,
      value: '2',
    });
  });

  it('leaves out cards nobody qualifies for', () => {
    // One 1u loss: only the worst day qualifies, nothing to brag about
    expect(
      superlatives([ann], [bet({ result: 'LOST' })], []).map((c) => c.key)
    ).toEqual(['worstDay']);
    expect(superlatives([ann], [], [])).toEqual([]);
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
          decimalOdds: 4,
          legs: [{ addedById: 'a', result: 'WON', americanOdds: 200 }],
        },
      ]
    );
    expect(page.leaderboard.map((r) => r.id)).toEqual(['b', 'a']);
    expect(page.group).toMatchObject({ wins: 1, losses: 0 });
    expect(page.group.people.map((r) => r.id)).toEqual(['a']);
  });

  it('breaks group record ties by the longer average odds', () => {
    // Same 1-0 record; Bo's leg was the longer price, so Bo ranks first
    // even though Ann comes first by name
    const page = recordsPage(
      'all',
      null,
      [ann, bo],
      [],
      [
        {
          postId: 'g',
          createdAt: new Date(),
          result: 'WON',
          decimalOdds: 4,
          legs: [
            { addedById: 'a', result: 'WON', americanOdds: -150 },
            { addedById: 'b', result: 'WON', americanOdds: 180 },
          ],
        },
      ]
    );
    expect(page.group.people.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('nearMisses', () => {
  it('counts parlays lost on exactly one leg and what they would have won', () => {
    expect(
      nearMisses([
        // One miss, a push doesn't count against it: would have won 2u * 5
        {
          result: 'LOST',
          legs: ['WON', 'PUSH', 'LOST'],
          units: 2,
          decimalOdds: 6,
        },
        // Two misses
        {
          result: 'LOST',
          legs: ['LOST', 'LOST', 'WON'],
          units: 1,
          decimalOdds: 9,
        },
        // A straight isn't a parlay
        { result: 'LOST', legs: ['LOST'], units: 1, decimalOdds: 2 },
        { result: 'WON', legs: ['WON', 'WON'], units: 1, decimalOdds: 3 },
      ])
    ).toEqual({ count: 1, units: 10 });
  });

  it('waits for every leg before calling it a one-leg miss', () => {
    // Lost the moment one leg missed, but the last leg is still being played
    expect(
      nearMisses([
        {
          result: 'LOST',
          legs: ['LOST', 'WON', 'PENDING'],
          units: 3,
          decimalOdds: 29.53,
        },
      ])
    ).toEqual({ count: 0, units: 0 });
  });

  it('tallies group parlays that missed by one and what $10 would have paid', () => {
    const page = recordsPage(
      'all',
      null,
      [ann, bo],
      [],
      [
        {
          postId: 'g1',
          createdAt: new Date(),
          result: 'LOST',
          decimalOdds: 12.5,
          legs: [
            { addedById: 'a', result: 'LOST', americanOdds: 150 },
            { addedById: 'b', result: 'WON', americanOdds: 150 },
          ],
        },
        {
          postId: 'g2',
          createdAt: new Date(),
          result: 'LOST',
          decimalOdds: 20,
          legs: [
            { addedById: 'a', result: 'LOST', americanOdds: 150 },
            { addedById: 'b', result: 'LOST', americanOdds: 150 },
          ],
        },
      ]
    );
    expect(page.group.nearMisses).toEqual({ count: 1, paid: 125 });
  });
});

describe('series rows', () => {
  it('scores each series from its own slips and names its owner', () => {
    const page = recordsPage(
      'all',
      null,
      [ann, bo],
      [
        bet({ result: 'WON', seriesId: 's1', postId: 'x1', decimalOdds: 3 }),
        bet({ result: 'LOST', seriesId: 's1', postId: 'x2' }),
        bet({ result: 'WON' }),
      ],
      [],
      [
        {
          id: 's1',
          name: 'CharLadder',
          emoji: '🪜',
          color: 'violet',
          ownerId: 'a',
        },
        {
          id: 's2',
          name: 'Sunday Locks',
          emoji: '🔒',
          color: 'sky',
          ownerId: 'b',
        },
      ]
    );
    expect(page.series[0]).toMatchObject({
      id: 's1',
      name: 'CharLadder',
      owner: ann,
      slips: 2,
      line: { wins: 1, losses: 1, net: 1 },
      l5: ['LOST', 'WON'],
    });
    // An empty series still lists, with nothing settled
    expect(page.series[1]).toMatchObject({ id: 's2', slips: 0, owner: bo });
  });
});
