import { describe, expect, it } from 'vitest';
import {
  allFinal,
  gameState,
  inGameMinutes,
  isLive,
  MAX_GAME_MS,
  oneGame,
  gameClock,
} from './live';

const start = '2026-10-18T17:00:00Z';
const t = (minutes: number) => new Date(start).getTime() + minutes * 60_000;

describe('gameState', () => {
  it('moves from upcoming to live to final', () => {
    expect(gameState(start, false, t(-5))).toBe('upcoming');
    expect(gameState(start, false, t(30))).toBe('live');
    expect(gameState(start, true, t(30))).toBe('final');
  });

  it('treats a game past any possible length as over', () => {
    expect(gameState(start, false, t(MAX_GAME_MS / 60_000 + 1))).toBe('final');
  });

  it('knows nothing about legs without a game', () => {
    expect(gameState(null, false, t(30))).toBe('unknown');
  });
});

describe('slip helpers', () => {
  const leg = (eventId: string, final = false) => ({
    eventId,
    startsAt: start,
    gameFinal: final,
  });

  it('spots one-game slips', () => {
    expect(oneGame([leg('a'), leg('a')])).toBe(true);
    expect(oneGame([leg('a'), leg('b')])).toBe(false);
    expect(oneGame([{ eventId: null, startsAt: null, gameFinal: false }])).toBe(
      false
    );
  });

  it('is live while any game is on, final once all are', () => {
    expect(isLive([leg('a')], t(30))).toBe(true);
    expect(allFinal([leg('a', true), leg('b')], t(30))).toBe(false);
    expect(allFinal([leg('a', true), leg('b', true)], t(30))).toBe(true);
  });
});

describe('inGameMinutes', () => {
  const at = (minutes: number) => new Date(t(minutes)).toISOString();

  it('counts minutes into the game for picks posted after kickoff', () => {
    expect(inGameMinutes(start, at(42.5))).toBe(42);
  });

  it('is null for picks posted before kickoff or without a game', () => {
    expect(inGameMinutes(start, at(-1))).toBeNull();
    expect(inGameMinutes(start, at(0))).toBeNull();
    expect(inGameMinutes(null, at(30))).toBeNull();
  });
});

describe('gameClock', () => {
  const nfl = 'americanfootball_nfl';
  const nhl = 'icehockey_nhl';
  const at = (name: string, period: number, displayClock = '4:12') => ({
    name,
    period,
    displayClock,
  });

  it('reads football quarters, halftime and overtime', () => {
    expect(gameClock(nfl, at('STATUS_IN_PROGRESS', 3))).toBe('Q3 4:12');
    expect(gameClock(nfl, at('STATUS_HALFTIME', 2))).toBe('Half');
    expect(gameClock(nfl, at('STATUS_END_PERIOD', 1))).toBe('End Q1');
    expect(gameClock(nfl, at('STATUS_IN_PROGRESS', 5, '2:05'))).toBe('OT 2:05');
    expect(gameClock(nfl, at('STATUS_FINAL', 4))).toBe('Final');
  });

  it('reads hockey periods, overtime and shootouts', () => {
    expect(gameClock(nhl, at('STATUS_IN_PROGRESS', 2, '08:41'))).toBe(
      'P2 08:41'
    );
    expect(gameClock(nhl, at('STATUS_END_PERIOD', 2))).toBe('End P2');
    expect(gameClock(nhl, at('STATUS_IN_PROGRESS', 4, '3:00'))).toBe('OT 3:00');
    expect(gameClock(nhl, at('STATUS_IN_PROGRESS', 5))).toBe('SO');
  });

  it('says nothing before kickoff', () => {
    expect(gameClock(nfl, at('STATUS_SCHEDULED', 0))).toBeNull();
  });
});
