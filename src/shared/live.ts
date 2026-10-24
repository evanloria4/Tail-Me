// Where a leg's game stands, for LIVE tags and "still waiting on a result"
// pending badges. The grader marks games final from ESPN; a game that's run
// far longer than any game could is treated as over even if it was never
// matched, so it doesn't sit "live" forever.

/** Longer than any NFL, college, NBA or NHL game, overtime included */
export const MAX_GAME_MS = 5 * 60 * 60_000;

export type GameState = 'upcoming' | 'live' | 'final' | 'unknown';

export function gameState(
  startsAt: string | null,
  final: boolean,
  now: number
): GameState {
  if (final) return 'final';
  if (!startsAt) return 'unknown'; // typed-in legs have no game attached
  const start = new Date(startsAt).getTime();
  if (now < start) return 'upcoming';
  return now - start > MAX_GAME_MS ? 'final' : 'live';
}

type LegGame = {
  eventId?: string | null;
  startsAt: string | null;
  gameFinal: boolean;
};

/** Every leg on the same game, e.g. a straight, a ladder or a same-game parlay */
export function oneGame(legs: LegGame[]): boolean {
  return (
    legs.length > 0 &&
    !!legs[0].eventId &&
    legs.every((l) => l.eventId === legs[0].eventId)
  );
}

/** A slip's game is on right now (only meaningful for oneGame slips) */
export const isLive = (legs: LegGame[], now: number) =>
  legs.some((l) => gameState(l.startsAt, l.gameFinal, now) === 'live');

/** Every game is over: an unsettled bet is now just waiting on its grade */
export const allFinal = (legs: LegGame[], now: number) =>
  legs.length > 0 &&
  legs.every((l) => gameState(l.startsAt, l.gameFinal, now) === 'final');

/**
 * Minutes into the game a leg was posted, or null if it was posted before
 * kickoff (or has no game). Those picks were made at live, in-game odds.
 */
export function inGameMinutes(
  startsAt: string | null,
  postedAt: string
): number | null {
  if (!startsAt) return null;
  const ms = new Date(postedAt).getTime() - new Date(startsAt).getTime();
  return ms > 0 ? Math.floor(ms / 60_000) : null;
}

/**
 * A short game clock from ESPN's status: "Q3 4:12", "Half", "End Q1",
 * "OT 2:05" for football and basketball; "P2 08:41", "End P2", "SO" for hockey; "Final".
 */
export function gameClock(
  sportKey: string,
  status: { name: string; period: number; displayClock: string }
): string | null {
  const { name, period, displayClock } = status;
  if (name === 'STATUS_FINAL') return 'Final';
  const hockey = sportKey.startsWith('icehockey');
  const regulation = hockey ? 3 : 4;
  let label = `${hockey ? 'P' : 'Q'}${period}`;
  if (period > regulation) label = hockey && period > 4 ? 'SO' : 'OT';
  if (name === 'STATUS_HALFTIME') return 'Half';
  if (name === 'STATUS_END_PERIOD') return `End ${label}`;
  if (name !== 'STATUS_IN_PROGRESS') return null;
  return label === 'SO' ? label : `${label} ${displayClock}`;
}
