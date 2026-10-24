// ESPN's public (unofficial, undocumented) scoreboard + box-score feed, used
// to grade bets. Free, but ESPN can change it without notice; anything that
// can't be read stays pending for manual grading.
import axios from 'axios';
import {
  easternDateKey,
  normName,
  normPlayer,
  PlayerStats,
  StatKey,
} from '../shared/grading';
import { gameClock } from '../shared/live';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const LEAGUE_PATHS: Record<string, string> = {
  americanfootball_nfl: 'football/nfl',
  americanfootball_ncaaf: 'football/college-football',
  icehockey_nhl: 'hockey/nhl',
};

// Short enough that a live game's scores and stats keep up with the grader
const SCOREBOARD_TTL = 2 * 60_000;
const LIVE_BOX_TTL = 2 * 60_000;
const BOX_TTL = 30 * 60_000;

export type EspnGame = {
  id: string;
  start: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  /** In progress (halftime and intermissions included) */
  live: boolean;
  /** Short clock for slips, e.g. "Q3 4:12", "Half", "Final"; null before */
  clock: string | null;
  /** Postponed / canceled / suspended: bets on it get voided */
  called: boolean;
};

// ---------- Cache ----------

const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttl: number, load: () => Promise<T>) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: Date.now() + ttl, value });
  value.catch(() => cache.delete(key));
  return value;
}

async function get<T>(url: string, params: Record<string, string> = {}) {
  const res = await axios.get<T>(url, { params, timeout: 15_000 });
  return res.data;
}

// ---------- Scoreboards ----------

type ApiCompetitor = {
  homeAway: 'home' | 'away';
  score?: string;
  team: { displayName: string };
};
type ApiEvent = {
  id: string;
  date: string;
  status: {
    period?: number;
    displayClock?: string;
    type: { name: string; state?: string; completed: boolean };
  };
  competitions: { competitors: ApiCompetitor[] }[];
};

function scoreboard(sportKey: string, date: string): Promise<EspnGame[]> {
  const path = LEAGUE_PATHS[sportKey];
  if (!path) return Promise.resolve([]);
  return cached(`sb:${sportKey}:${date}`, SCOREBOARD_TTL, async () => {
    const params: Record<string, string> = { dates: date, limit: '400' };
    // College: every FBS game, not just ESPN's featured ones
    if (sportKey === 'americanfootball_ncaaf') params.groups = '80';
    const body = await get<{ events: ApiEvent[] }>(
      `${BASE}/${path}/scoreboard`,
      params
    );
    return body.events.flatMap((e) => {
      const teams = e.competitions[0]?.competitors ?? [];
      const home = teams.find((t) => t.homeAway === 'home');
      const away = teams.find((t) => t.homeAway === 'away');
      if (!home || !away) return [];
      const status = e.status.type.name;
      return [
        {
          id: e.id,
          start: new Date(e.date),
          homeTeam: home.team.displayName,
          awayTeam: away.team.displayName,
          homeScore: Number(home.score ?? 0),
          awayScore: Number(away.score ?? 0),
          completed: e.status.type.completed && status === 'STATUS_FINAL',
          live: e.status.type.state === 'in',
          clock: gameClock(sportKey, {
            name: status,
            period: e.status.period ?? 0,
            displayClock: e.status.displayClock ?? '',
          }),
          called: /POSTPONED|CANCELED|SUSPENDED|FORFEIT/.test(status),
        },
      ];
    });
  });
}

/**
 * Finds our game on ESPN: same Eastern date (or the day either side), both
 * team names matching, or failing that one team and a start within 6 hours.
 */
export async function findGame(
  sportKey: string,
  homeTeam: string,
  awayTeam: string,
  start: Date
): Promise<EspnGame | null> {
  const day = 24 * 60 * 60_000;
  const dates = [
    ...new Set(
      [start.getTime() - day, start.getTime(), start.getTime() + day].map((t) =>
        easternDateKey(new Date(t))
      )
    ),
  ];
  const games = (
    await Promise.all(dates.map((d) => scoreboard(sportKey, d)))
  ).flat();
  const home = normName(homeTeam);
  const away = normName(awayTeam);
  const near = (g: EspnGame) =>
    Math.abs(g.start.getTime() - start.getTime()) < 6 * 60 * 60_000;
  return (
    games.find(
      (g) => normName(g.homeTeam) === home && normName(g.awayTeam) === away
    ) ??
    games.find(
      (g) =>
        near(g) &&
        (normName(g.homeTeam) === home || normName(g.awayTeam) === away)
    ) ??
    null
  );
}

// ---------- Box scores ----------

type ApiCategory = {
  name: string;
  keys: string[];
  athletes: { athlete: { displayName: string }; stats: string[] }[];
};
type ApiSummary = {
  boxscore?: { players?: { statistics: ApiCategory[] }[] };
};

/** "27/51" -> 27; "278" -> 278; "--" -> 0 */
const num = (v: string | undefined) => {
  const n = parseFloat((v ?? '').split('/')[0]);
  return Number.isFinite(n) ? n : 0;
};

/** Which box-score column feeds which stat, per category */
const FOOTBALL_COLUMNS: Record<string, Record<string, StatKey>> = {
  passing: {
    'completions/passingAttempts': 'completions',
    passingYards: 'passYds',
    passingTouchdowns: 'passTds',
    interceptions: 'ints',
  },
  rushing: { rushingAttempts: 'rushAtt', rushingYards: 'rushYds' },
  receiving: { receptions: 'receptions', receivingYards: 'recYds' },
};
/** Touchdowns a player scored themselves (passing TDs don't count) */
const TD_COLUMNS: Record<string, string> = {
  rushing: 'rushingTouchdowns',
  receiving: 'receivingTouchdowns',
  kickReturns: 'kickReturnTouchdowns',
  puntReturns: 'puntReturnTouchdowns',
  interceptions: 'interceptionTouchdowns',
};
const HOCKEY_COLUMNS: Record<string, StatKey> = {
  goals: 'goals',
  assists: 'assists',
  shotsTotal: 'shots',
  saves: 'saves',
};

function parseBox(sportKey: string, summary: ApiSummary) {
  const players = new Map<string, PlayerStats>();
  const hockey = sportKey.startsWith('icehockey');
  summary.boxscore?.players?.forEach((team) =>
    team.statistics.forEach((cat) =>
      cat.athletes.forEach(({ athlete, stats }) => {
        const key = normPlayer(athlete.displayName);
        // Anyone in the box score played: stats they have no column for are 0
        const line = players.get(key) ?? {};
        const col = (name: string) => num(stats[cat.keys.indexOf(name)]);
        if (hockey) {
          Object.entries(HOCKEY_COLUMNS).forEach(([column, stat]) => {
            if (cat.keys.includes(column)) line[stat] = col(column);
          });
        } else {
          Object.entries(FOOTBALL_COLUMNS[cat.name] ?? {}).forEach(
            ([column, stat]) => {
              if (cat.keys.includes(column)) line[stat] = col(column);
            }
          );
          const td = TD_COLUMNS[cat.name];
          if (td && cat.keys.includes(td)) line.tds = (line.tds ?? 0) + col(td);
        }
        players.set(key, line);
      })
    )
  );
  if (hockey) {
    players.forEach((line) => {
      // eslint-disable-next-line no-param-reassign
      line.points = (line.goals ?? 0) + (line.assists ?? 0);
    });
  }
  return players;
}

/**
 * Player stats keyed by normPlayer(name): a finished game's, or so far in a
 * live one (cached briefly and apart from the final's).
 */
export function boxScore(
  sportKey: string,
  espnId: string,
  live = false
): Promise<Map<string, PlayerStats>> {
  const path = LEAGUE_PATHS[sportKey];
  if (!path) return Promise.resolve(new Map());
  const key = `box:${espnId}:${live ? 'live' : 'final'}`;
  return cached(key, live ? LIVE_BOX_TTL : BOX_TTL, async () =>
    parseBox(
      sportKey,
      await get<ApiSummary>(`${BASE}/${path}/summary`, { event: espnId })
    )
  );
}
