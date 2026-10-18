// Auto-grading. Every few minutes: find pending legs whose game should be
// over, look the game up on ESPN, grade game lines from the final score and
// props from the box score, then roll leg results up into their bets.
// Results a person set (gradedBy MANUAL) are never touched, and anything that
// can't be matched stays pending for the poster to grade by hand.
import prisma from './db';
import { boxScore, EspnGame, findGame } from './espn';
import {
  betResultFromLegs,
  gradeGameLine,
  gradeProp,
  normPlayer,
  propStat,
} from '../shared/grading';
import type { BetResult } from '../shared/posts';

const INTERVAL = 10 * 60_000;
/** A game can't be final sooner than this after it starts */
const MIN_GAME_LENGTH = 2 * 60 * 60_000;
/** Stop retrying games this old; they're left for manual grading */
const GIVE_UP_AFTER = 7 * 24 * 60 * 60_000;

/**
 * Bets nobody graded by hand. (A plain `not: 'MANUAL'` would also drop
 * never-graded rows: SQL comparisons with NULL are never true.)
 */
const NOT_MANUAL = {
  OR: [{ gradedBy: null }, { gradedBy: 'AUTO' as const }],
};

type LegGrade = { result: BetResult; actual: number | null };

/** Grade one leg against its game, or null if it can't be graded yet */
async function gradeLeg(
  leg: {
    sportKey: string;
    marketKey: string;
    marketLabel: string | null;
    playerName: string | null;
    selection: string;
    line: { toNumber(): number } | null;
  },
  game: EspnGame
): Promise<LegGrade | null> {
  if (game.called) return { result: 'VOID', actual: null };
  if (!game.completed) return null;

  const line = leg.line?.toNumber() ?? null;
  if (leg.marketKey !== 'player_prop') {
    const result = gradeGameLine(
      { marketKey: leg.marketKey, selection: leg.selection, line },
      game
    );
    return result === 'PENDING' ? null : { result, actual: null };
  }

  const stat = propStat(leg.sportKey, leg.marketLabel);
  if (!stat || !leg.playerName) return null;
  const players = await boxScore(leg.sportKey, game.id);
  const player = players.get(normPlayer(leg.playerName));
  // Not in the box score: didn't play, or a name we can't match. Books void
  // props for players who sit, but we can't tell the two apart, so a person
  // grades it.
  if (!player) return null;
  const actual = player[stat] ?? 0;
  const result = gradeProp(leg.selection, line, actual);
  return result === 'PENDING' ? null : { result, actual };
}

/** dryRun: report what would be graded without writing anything */
export async function runGrading(now = new Date(), { dryRun = false } = {}) {
  const legs = await prisma.betLeg.findMany({
    where: {
      result: 'PENDING',
      gradedBy: null,
      event: {
        commenceTime: {
          lt: new Date(now.getTime() - MIN_GAME_LENGTH),
          gt: new Date(now.getTime() - GIVE_UP_AFTER),
        },
      },
      // Group parlays only grade once their legs are fixed
      bet: {
        ...NOT_MANUAL,
        post: {
          OR: [
            { type: { not: 'GROUP_PARLAY' } },
            { lockedAt: { not: null } },
            { lockAt: { lte: now } },
          ],
        },
      },
    },
    include: { event: true },
  });
  const report: string[] = [];
  if (!legs.length) return { graded: 0, bets: 0, report };

  // Look each game up once
  const games = new Map<string, EspnGame | null>();
  await Promise.all(
    [...new Set(legs.map((l) => l.eventId!))].map(async (eventId) => {
      const ev = legs.find((l) => l.eventId === eventId)!.event!;
      try {
        const game = await findGame(
          ev.sportKey,
          ev.homeTeam,
          ev.awayTeam,
          ev.commenceTime
        );
        games.set(eventId, game);
        if (game?.completed && !ev.completed && !dryRun) {
          await prisma.event.update({
            where: { id: eventId },
            data: {
              completed: true,
              homeScore: game.homeScore,
              awayScore: game.awayScore,
              espnId: game.id,
            },
          });
        }
      } catch (err) {
        console.error(`Grading: ESPN lookup failed for ${eventId}`, err);
        games.set(eventId, null);
      }
    })
  );

  const touchedBets = new Set<string>();
  let graded = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const leg of legs) {
    const game = games.get(leg.eventId!);
    if (!game) continue; // eslint-disable-line no-continue
    let grade: LegGrade | null = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      grade = await gradeLeg(leg, game);
    } catch (err) {
      console.error(`Grading: box score failed for ${game.id}`, err);
    }
    report.push(
      `${leg.eventLabel} | ${leg.playerName ?? ''} ${leg.selection} ${leg.line ?? ''} ${leg.marketLabel ?? leg.marketKey} -> ${grade?.result ?? 'pending'}${grade?.actual != null ? ` (${grade.actual})` : ''}`
    );
    if (!grade || dryRun) continue; // eslint-disable-line no-continue
    // eslint-disable-next-line no-await-in-loop
    await prisma.betLeg.update({
      where: { id: leg.id },
      data: { result: grade.result, actual: grade.actual, gradedBy: 'AUTO' },
    });
    touchedBets.add(leg.betId);
    graded += 1;
  }

  if (dryRun) return { graded, bets: 0, report };

  // Roll leg results up into each bet the poster hasn't graded by hand
  let betsSettled = 0;
  const bets = await prisma.bet.findMany({
    where: { id: { in: [...touchedBets] }, ...NOT_MANUAL },
    include: { legs: { select: { result: true } } },
  });
  await Promise.all(
    bets.map(async (bet) => {
      const result = betResultFromLegs(bet.legs.map((l) => l.result));
      if (result === bet.result) return;
      await prisma.bet.update({
        where: { id: bet.id },
        data: {
          result,
          settledAt: result === 'PENDING' ? null : now,
          gradedBy: result === 'PENDING' ? null : 'AUTO',
        },
      });
      betsSettled += 1;
    })
  );

  return { graded, bets: betsSettled, report };
}

/** Runs the grader shortly after boot, then every INTERVAL */
export function startGrader() {
  if (process.env.DISABLE_GRADER === 'true') return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { graded, bets } = await runGrading();
      if (graded) console.log(`Grading: ${graded} legs, ${bets} bets settled`);
    } catch (err) {
      console.error('Grading run failed', err);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, INTERVAL);
}
