import { describe, expect, it } from 'vitest';
import { allFinal, gameState, isLive, MAX_GAME_MS, oneGame } from './live';

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
