import { describe, expect, it } from 'vitest';
import {
  betResultFromLegs,
  easternDateKey,
  gradeGameLine,
  gradeLiveGameLine,
  gradeLiveProp,
  gradeProp,
  normName,
  normPlayer,
  propStat,
} from './grading';

const game = {
  homeTeam: 'Denver Broncos',
  awayTeam: 'Seattle Seahawks',
  homeScore: 17,
  awayScore: 14,
};

describe('normName / normPlayer', () => {
  it('ignores accents, apostrophes and case', () => {
    expect(normName("Hawai'i Rainbow Warriors")).toBe(
      normName('Hawaii Rainbow Warriors')
    );
    expect(normName('Montréal Canadiens')).toBe('montreal canadiens');
  });

  it('drops name suffixes and initials punctuation', () => {
    expect(normPlayer('Kenneth Walker III')).toBe('kenneth walker');
    expect(normPlayer('J.K. Dobbins')).toBe(normPlayer('JK Dobbins'));
    expect(normPlayer('Marvin Harrison Jr.')).toBe('marvin harrison');
  });
});

describe('gradeGameLine', () => {
  it('grades moneylines, including ties', () => {
    expect(
      gradeGameLine(
        { marketKey: 'h2h', selection: 'Denver Broncos', line: null },
        game
      )
    ).toBe('WON');
    expect(
      gradeGameLine(
        { marketKey: 'h2h', selection: 'Seattle Seahawks', line: null },
        game
      )
    ).toBe('LOST');
    expect(
      gradeGameLine(
        { marketKey: 'h2h', selection: 'Denver Broncos', line: null },
        { ...game, awayScore: 17 }
      )
    ).toBe('PUSH');
  });

  it('grades spreads from either side', () => {
    expect(
      gradeGameLine(
        { marketKey: 'spreads', selection: 'Seattle Seahawks', line: 3.5 },
        game
      )
    ).toBe('WON');
    expect(
      gradeGameLine(
        { marketKey: 'spreads', selection: 'Denver Broncos', line: -3.5 },
        game
      )
    ).toBe('LOST');
    expect(
      gradeGameLine(
        { marketKey: 'spreads', selection: 'Denver Broncos', line: -3 },
        game
      )
    ).toBe('PUSH');
  });

  it('grades totals', () => {
    expect(
      gradeGameLine(
        { marketKey: 'totals', selection: 'Under', line: 44.5 },
        game
      )
    ).toBe('WON');
    expect(
      gradeGameLine(
        { marketKey: 'totals', selection: 'Over', line: 30.5 },
        game
      )
    ).toBe('WON');
    expect(
      gradeGameLine({ marketKey: 'totals', selection: 'Over', line: 31 }, game)
    ).toBe('PUSH');
  });

  it('stays pending when the pick names neither team', () => {
    expect(
      gradeGameLine({ marketKey: 'h2h', selection: 'Chiefs', line: null }, game)
    ).toBe('PENDING');
  });
});

describe('gradeProp', () => {
  it('grades over/under against the actual stat', () => {
    expect(gradeProp('Over', 220.5, 278)).toBe('WON');
    expect(gradeProp('Under', 220.5, 278)).toBe('LOST');
    expect(gradeProp('Over', 5, 5)).toBe('PUSH');
  });

  it('grades yes props on one or more', () => {
    expect(gradeProp('Yes', null, 1)).toBe('WON');
    expect(gradeProp('Yes', null, 0)).toBe('LOST');
  });
});

describe('mid-game grading', () => {
  it('settles only what the rest of the game can’t undo', () => {
    expect(gradeLiveProp('Under', 49.5, 52)).toBe('LOST');
    expect(gradeLiveProp('Over', 49.5, 52)).toBe('WON');
    expect(gradeLiveProp('Over', 49.5, 49)).toBe('PENDING');
    expect(gradeLiveProp('Under', 49.5, 49)).toBe('PENDING');
    // Sitting on the line could still push or go either way
    expect(gradeLiveProp('Under', 5, 5)).toBe('PENDING');
    expect(gradeLiveProp('Yes', null, 1)).toBe('WON');
    expect(gradeLiveProp('Yes', null, 0)).toBe('PENDING');
  });

  it('grades totals the score has passed, never sides', () => {
    const live = { ...game, homeScore: 24, awayScore: 21 };
    expect(
      gradeLiveGameLine(
        { marketKey: 'totals', selection: 'Under', line: 44.5 },
        live
      )
    ).toBe('LOST');
    expect(
      gradeLiveGameLine(
        { marketKey: 'totals', selection: 'Over', line: 44.5 },
        live
      )
    ).toBe('WON');
    expect(
      gradeLiveGameLine(
        { marketKey: 'h2h', selection: 'Denver Broncos', line: null },
        live
      )
    ).toBe('PENDING');
    expect(
      gradeLiveGameLine(
        { marketKey: 'spreads', selection: 'Denver Broncos', line: -3.5 },
        live
      )
    ).toBe('PENDING');
  });
});

describe('propStat', () => {
  it('maps posted prop labels per sport', () => {
    expect(propStat('americanfootball_nfl', 'Passing Yards')).toBe('passYds');
    expect(propStat('americanfootball_ncaaf', 'Anytime TD')).toBe('tds');
    expect(propStat('icehockey_nhl', 'Shots on Goal')).toBe('shots');
    expect(propStat('icehockey_nhl', 'Passing Yards')).toBeUndefined();
    expect(propStat('americanfootball_nfl', null)).toBeUndefined();
  });
});

describe('betResultFromLegs', () => {
  it('uses the single leg for straights and rungs', () => {
    expect(betResultFromLegs(['LOST'])).toBe('LOST');
  });

  it('applies parlay rules to multiple legs', () => {
    expect(betResultFromLegs(['WON', 'PENDING'])).toBe('PENDING');
    expect(betResultFromLegs(['WON', 'LOST', 'PENDING'])).toBe('LOST');
    expect(betResultFromLegs(['WON', 'VOID', 'WON'])).toBe('WON');
  });
});

describe('easternDateKey', () => {
  it('uses the US Eastern calendar day', () => {
    // 8:15 PM ET on Oct 15 is already Oct 16 in UTC
    expect(easternDateKey(new Date('2026-10-16T00:15:00Z'))).toBe('20261015');
  });
});
