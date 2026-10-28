import { describe, expect, it } from 'vitest';
import type { OddsOutcome } from '../../shared/markets';
import { createPostSchema } from '../../shared/posts';
import { gradeGameLine, propStat } from '../../shared/grading';
import {
  baseMarket,
  buildPost,
  canLadder,
  isSameGame,
  mainLinesFromAlts,
  legToSelection,
  matchesPick,
  Selection,
  selectionKey,
  selectionTitle,
  toLeg,
  toSelection,
} from './slip';

const NFL = 'americanfootball_nfl';

function sel(
  marketKey: string,
  outcome: OddsOutcome,
  { eventId = 'evt1', marketLabel = 'Passing Yards' } = {}
): Selection {
  return {
    key: selectionKey(eventId, marketKey, outcome),
    sportKey: NFL,
    eventId,
    eventLabel: 'Seattle Seahawks @ Denver Broncos',
    marketKey,
    marketLabel,
    outcome,
  };
}

const over = (point: number, price: number, player = 'Bo Nix') =>
  sel('player_pass_yds_alternate', {
    name: 'Over',
    player,
    point,
    price,
    sid: `sid-${point}`,
    link: `https://sportsbook.fanduel.com/addToBetslip?selectionId=${point}`,
  });

describe('baseMarket', () => {
  it('strips alternate prefixes and suffixes', () => {
    expect(baseMarket('player_pass_yds_alternate')).toBe('player_pass_yds');
    expect(baseMarket('alternate_spreads')).toBe('spreads');
    expect(baseMarket('h2h')).toBe('h2h');
  });
});

describe('selectionTitle', () => {
  it('reads like a bet slip line', () => {
    expect(
      selectionTitle(
        sel(
          'spreads',
          { name: 'Denver Broncos', point: 2.5, price: -110 },
          { marketLabel: 'Spread' }
        )
      )
    ).toBe('Denver Broncos +2.5');
    expect(
      selectionTitle(
        sel(
          'totals',
          { name: 'Under', point: 44.5, price: -110 },
          { marketLabel: 'Total' }
        )
      )
    ).toBe('Under 44.5');
    expect(selectionTitle(over(197.5, -113))).toBe('Bo Nix Over 197.5');
    expect(
      selectionTitle(
        sel(
          'player_anytime_td',
          { name: 'Yes', player: 'J.K. Dobbins', price: 170 },
          { marketLabel: 'Anytime TD' }
        )
      )
    ).toBe('J.K. Dobbins Anytime TD');
  });
});

describe('canLadder', () => {
  it('accepts the same pick at different lines', () => {
    expect(canLadder([over(174.5, -210), over(199.5, 110)])).toBe(true);
  });

  it('accepts a main line mixed with its alternates', () => {
    const main = sel('player_pass_yds', {
      name: 'Over',
      player: 'Bo Nix',
      point: 197.5,
      price: -113,
    });
    expect(canLadder([main, over(224.5, 180)])).toBe(true);
  });

  it('rejects different players, sides, or a single pick', () => {
    expect(canLadder([over(174.5, -210)])).toBe(false);
    expect(
      canLadder([over(174.5, -210), over(199.5, 110, 'Sam Darnold')])
    ).toBe(false);
    const under = sel('player_pass_yds_alternate', {
      name: 'Under',
      player: 'Bo Nix',
      point: 224.5,
      price: -150,
    });
    expect(canLadder([over(174.5, -210), under])).toBe(false);
  });
});

describe('isSameGame', () => {
  it('needs 2+ legs from one game', () => {
    expect(isSameGame([over(174.5, -210)])).toBe(false);
    expect(isSameGame([over(174.5, -210), over(199.5, 110)])).toBe(true);
    expect(
      isSameGame([
        over(174.5, -210),
        sel('h2h', { name: 'X', price: 100 }, { eventId: 'evt2' }),
      ])
    ).toBe(false);
  });
});

describe('buildPost', () => {
  const common = {
    sportsbookKey: 'fanduel',
    units: 1,
    rungUnits: {},
  };

  it('builds a straight bet that keeps the book link', () => {
    const pick = sel(
      'h2h',
      {
        name: 'Denver Broncos',
        price: 124,
        sid: '50211',
        link: 'https://sportsbook.fanduel.com/addToBetslip?marketId=42.1&selectionId=50211',
      },
      { marketLabel: 'Moneyline' }
    );
    const post = buildPost({ ...common, mode: 'STRAIGHT', selections: [pick] });
    const parsed = createPostSchema.parse(post);
    expect(parsed.type).toBe('STRAIGHT');
    if (parsed.type !== 'STRAIGHT') return;
    expect(parsed.leg).toMatchObject({
      marketKey: 'h2h',
      selection: 'Denver Broncos',
      line: null,
      eventId: 'evt1',
      bookSelectionId: '50211',
    });
  });

  it('builds a ladder sorted by line with per-rung units', () => {
    const a = over(224.5, 180);
    const b = over(174.5, -210);
    const post = buildPost({
      ...common,
      mode: 'LADDER',
      selections: [a, b],
      rungUnits: { [a.key]: 0.5 },
    });
    const parsed = createPostSchema.parse(post);
    if (parsed.type !== 'LADDER') throw new Error('expected ladder');
    expect(parsed.pick).toMatchObject({
      marketKey: 'player_prop',
      marketLabel: 'Passing Yards',
      playerName: 'Bo Nix',
      selection: 'Over',
    });
    expect(parsed.rungs.map((r) => [r.line, r.units])).toEqual([
      [174.5, 1],
      [224.5, 0.5],
    ]);
    expect(parsed.rungs[0].bookSelectionId).toBe('sid-174.5');
  });

  it('builds a parlay with an optional book price', () => {
    const post = buildPost({
      ...common,
      mode: 'PARLAY',
      selections: [
        sel('spreads', { name: 'Denver Broncos', point: 2.5, price: -110 }),
        sel(
          'player_anytime_td',
          { name: 'Yes', player: 'J.K. Dobbins', price: 170 },
          { marketLabel: 'Anytime TD' }
        ),
      ],
      slipOdds: 350,
    });
    const parsed = createPostSchema.parse(post);
    if (parsed.type !== 'PARLAY') throw new Error('expected parlay');
    expect(parsed.slipOdds).toBe(350);
    expect(parsed.legs[1]).toMatchObject({
      marketKey: 'player_prop',
      playerName: 'J.K. Dobbins',
      selection: 'Yes',
      line: null,
    });
  });
});

describe('legToSelection / matchesPick', () => {
  const game = { id: 'ev1', sportKey: 'americanfootball_nfl' };
  const posted = {
    id: 'leg1',
    sportKey: 'americanfootball_nfl',
    eventId: 'ev1',
    eventLabel: 'Broncos @ Chiefs',
    startsAt: '2026-10-25T17:00:00Z',
    gameFinal: false,
    score: null,
    marketKey: 'player_prop' as const,
    marketLabel: 'Passing Yards',
    playerName: 'Bo Nix',
    selection: 'Over',
    line: 197.5,
    americanOdds: -115,
    deepLink: null,
    result: 'PENDING' as const,
    actual: null,
    addedBy: null,
  };

  it('keeps the posted price and leg id', () => {
    const s = legToSelection(posted);
    expect(s.legId).toBe('leg1');
    expect(s.outcome.price).toBe(-115);
    expect(selectionTitle(s)).toBe('Bo Nix Over 197.5');
  });

  it('matches the same live outcome, including its alternate market', () => {
    const s = legToSelection(posted);
    const o = { name: 'Over', player: 'Bo Nix', point: 197.5, price: -120 };
    expect(matchesPick(s, game, 'player_pass_yds', o)).toBe(true);
    expect(matchesPick(s, game, 'player_pass_yds_alternate', o)).toBe(true);
    expect(
      matchesPick(s, game, 'player_pass_yds', { ...o, point: 210.5 })
    ).toBe(false);
    expect(matchesPick(s, game, 'player_rush_yds', o)).toBe(false);
  });
});

describe('mainLinesFromAlts', () => {
  const alt = (player: string, name: string, point: number, price: number) =>
    ({ player, name, point, price }) as OddsOutcome;

  it('picks each team’s most evenly priced Over / Under', () => {
    const lines = mainLinesFromAlts([
      alt('Saints', 'Over', 17.5, -196),
      alt('Saints', 'Under', 17.5, 152),
      alt('Saints', 'Over', 20.5, -115),
      alt('Saints', 'Under', 20.5, -111),
      alt('Saints', 'Over', 23.5, 142),
      alt('Saints', 'Under', 23.5, -184),
      alt('Steelers', 'Over', 23.5, -122),
      alt('Steelers', 'Under', 23.5, -104),
      alt('Steelers', 'Over', 27.5, 190),
    ]);
    expect(lines.map((o) => `${o.player} ${o.name} ${o.point}`)).toEqual([
      'Saints Over 20.5',
      'Saints Under 20.5',
      'Steelers Over 23.5',
      'Steelers Under 23.5',
    ]);
  });

  it('skips points without both sides', () => {
    expect(mainLinesFromAlts([alt('Saints', 'Over', 20.5, -110)])).toEqual([]);
  });
});

describe('custom lines', () => {
  const game = {
    id: 'ev1',
    sportKey: 'americanfootball_nfl',
    awayTeam: 'Denver Broncos',
    homeTeam: 'Kansas City Chiefs',
    commenceTime: '2026-10-25T17:00:00Z',
  };

  it('a typed prop line is stored like a picked one, so it grades', () => {
    const leg = toLeg(
      toSelection(game, 'player_pass_yds', {
        name: 'Over',
        player: 'Bo Nix',
        point: 287.5,
        price: 150,
      })
    );
    expect(leg).toMatchObject({
      eventId: 'ev1',
      marketKey: 'player_prop',
      marketLabel: 'Passing Yards',
      playerName: 'Bo Nix',
      selection: 'Over',
      line: 287.5,
      americanOdds: 150,
    });
    expect(leg.deepLink).toBeUndefined();
    // The grader finds the stat to check from the market label
    expect(propStat(leg.sportKey, leg.marketLabel ?? null)).toBeDefined();
  });

  it('a typed alt spread grades from the final score', () => {
    const leg = toLeg(
      toSelection(game, 'alternate_spreads', {
        name: 'Kansas City Chiefs',
        point: -10.5,
        price: 220,
      })
    );
    expect(leg.marketKey).toBe('spreads');
    expect(
      gradeGameLine(
        {
          marketKey: leg.marketKey,
          selection: leg.selection,
          line: leg.line ?? null,
        },
        { ...game, homeScore: 31, awayScore: 17 }
      )
    ).toBe('WON');
  });
});
