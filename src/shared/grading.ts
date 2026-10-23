// Auto-grading rules, kept pure so they're easy to test. The server's grader
// (src/server/grading.ts) feeds these final scores and box-score stats.
import { BetResult, groupResult } from './posts';

/** Team names compared without accents, apostrophes or case ("Hawai'i" = "Hawaii") */
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Player names also drop suffixes, so "Kenneth Walker III" = "Kenneth Walker" */
export function normPlayer(s: string): string {
  return normName(s)
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type FinalScore = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

type GameLeg = { marketKey: string; selection: string; line: number | null };

/** Moneyline / spread / total from a final score. PENDING if it can't tell. */
export function gradeGameLine(leg: GameLeg, game: FinalScore): BetResult {
  const total = game.homeScore + game.awayScore;
  if (leg.marketKey === 'totals') {
    if (leg.line == null) return 'PENDING';
    if (total === leg.line) return 'PUSH';
    if (leg.selection === 'Over') return total > leg.line ? 'WON' : 'LOST';
    if (leg.selection === 'Under') return total < leg.line ? 'WON' : 'LOST';
    return 'PENDING';
  }

  const pick = normName(leg.selection);
  let mine: number;
  let theirs: number;
  if (pick === normName(game.homeTeam)) {
    mine = game.homeScore;
    theirs = game.awayScore;
  } else if (pick === normName(game.awayTeam)) {
    mine = game.awayScore;
    theirs = game.homeScore;
  } else {
    return 'PENDING';
  }

  if (leg.marketKey === 'h2h') {
    if (mine === theirs) return 'PUSH';
    return mine > theirs ? 'WON' : 'LOST';
  }
  if (leg.marketKey === 'spreads') {
    if (leg.line == null) return 'PENDING';
    const margin = mine + leg.line - theirs;
    if (margin === 0) return 'PUSH';
    return margin > 0 ? 'WON' : 'LOST';
  }
  return 'PENDING';
}

/** Over/Under a line, or a Yes prop (anytime TD/goal) needing at least 1 */
export function gradeProp(
  selection: string,
  line: number | null,
  actual: number
): BetResult {
  if (selection === 'Yes') return actual >= 1 ? 'WON' : 'LOST';
  if (line == null) return 'PENDING';
  if (actual === line) return 'PUSH';
  if (selection === 'Over') return actual > line ? 'WON' : 'LOST';
  if (selection === 'Under') return actual < line ? 'WON' : 'LOST';
  return 'PENDING';
}

/**
 * Mid-game: only what's already decided. Stats and scores climb, so a stat
 * past an Over's line has hit, past an Under's line has lost, and a Yes prop
 * hits at its first one. Everything else waits for the final. Yardage can
 * dip (a sack, a loss on a carry), so the grader re-checks these at the final.
 */
export function gradeLiveProp(
  selection: string,
  line: number | null,
  actual: number
): BetResult {
  if (selection === 'Yes') return actual >= 1 ? 'WON' : 'PENDING';
  if (line == null || actual <= line) return 'PENDING';
  if (selection === 'Over') return 'WON';
  if (selection === 'Under') return 'LOST';
  return 'PENDING';
}

/** Mid-game game lines: only a total the score has already passed */
export function gradeLiveGameLine(leg: GameLeg, game: FinalScore): BetResult {
  if (leg.marketKey !== 'totals') return 'PENDING';
  return gradeLiveProp(
    leg.selection,
    leg.line,
    game.homeScore + game.awayScore
  );
}

/** A player's box-score line, normalized across sports */
export type StatKey =
  | 'passYds'
  | 'passTds'
  | 'completions'
  | 'ints'
  | 'rushYds'
  | 'rushAtt'
  | 'recYds'
  | 'receptions'
  | 'tds'
  | 'goals'
  | 'assists'
  | 'points'
  | 'shots'
  | 'saves';
export type PlayerStats = Partial<Record<StatKey, number>>;

/** Prop label (as posted, from shared/markets.ts) -> the stat that grades it */
const FOOTBALL_PROPS: Record<string, StatKey> = {
  'Passing Yards': 'passYds',
  'Passing TDs': 'passTds',
  Completions: 'completions',
  Interceptions: 'ints',
  'Rushing Yards': 'rushYds',
  'Rush Attempts': 'rushAtt',
  'Receiving Yards': 'recYds',
  Receptions: 'receptions',
  'Anytime TD': 'tds',
};
const HOCKEY_PROPS: Record<string, StatKey> = {
  Points: 'points',
  Assists: 'assists',
  'Anytime Goal': 'goals',
  'Shots on Goal': 'shots',
  Saves: 'saves',
};

export function propStat(
  sportKey: string,
  marketLabel: string | null
): StatKey | undefined {
  if (!marketLabel) return undefined;
  const table = sportKey.startsWith('icehockey')
    ? HOCKEY_PROPS
    : FOOTBALL_PROPS;
  return table[marketLabel];
}

/**
 * A bet's result from its legs: straights and ladder rungs are their one leg;
 * parlays (personal or group) use the group rule (any loss sinks it, voided
 * legs drop out, all pushes is a push).
 */
export function betResultFromLegs(legs: BetResult[]): BetResult {
  return legs.length === 1 ? legs[0] : groupResult(legs);
}

/** ESPN's scoreboards are keyed by US Eastern date, e.g. "20261015" */
export function easternDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}${get('month')}${get('day')}`;
}
