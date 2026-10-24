// Odds API markets the bet picker offers, and the shapes it serves. Shared so
// the server can whitelist what it will spend credits on and the client can
// label what it shows.

/** A price for one side of a market at one book */
export type OddsOutcome = {
  /** Team, "Over"/"Under", or "Yes" */
  name: string;
  /** Player for props (the Odds API's `description`) */
  player?: string;
  point?: number;
  price: number;
  /** Adds this pick to the book's bet slip */
  link?: string;
  /** Book's own selection id */
  sid?: string;
};

export type BookOdds = {
  /** The game's page at this book */
  link?: string;
  markets: Record<string, OddsOutcome[]>;
};

export type OddsGame = {
  id: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  /** Keyed by sportsbook key */
  books: Record<string, BookOdds>;
};

export type EventMarkets = {
  eventId: string;
  books: Record<string, BookOdds>;
};

export const GAME_MARKETS = ['h2h', 'spreads', 'totals'] as const;

/** The one sportsbook live odds (and so picked slips) come from, for now */
export const LIVE_ODDS_BOOK = 'fanduel';

export type PickerMarket = {
  key: string;
  label: string;
  /** Alternate-line market for building ladders */
  alt?: string;
  /** One-sided props like "Anytime TD" (outcome name "Yes") */
  yesNo?: boolean;
  /** Load the alt market too, and show its most even line when the book
   * lists no main one (FanDuel posts some games' team totals only as alts) */
  altFallback?: boolean;
};

export type PickerCategory = {
  key: string;
  label: string;
  markets: PickerMarket[];
  /** Game-level markets (alt spreads/totals) rather than player props */
  game?: boolean;
};

const ALT_LINES: PickerCategory = {
  key: 'alt',
  label: 'Alt Lines',
  game: true,
  markets: [
    { key: 'alternate_spreads', label: 'Alt Spread' },
    { key: 'alternate_totals', label: 'Alt Total' },
    { key: 'alternate_team_totals', label: 'Alt Team Total' },
  ],
};

/** How team totals are labeled; graded from the team's score, not a box score */
export const TEAM_TOTAL_LABEL = 'Team Total';

// Team totals come shaped like props (Over/Under, the team as the "player"),
// so they ride the prop machinery: rows, alt-line ladders, imports
const TEAM_TOTALS: PickerCategory = {
  key: 'team',
  label: 'Team Totals',
  markets: [
    {
      key: 'team_totals',
      label: TEAM_TOTAL_LABEL,
      alt: 'alternate_team_totals',
      altFallback: true,
    },
  ],
};

const FOOTBALL: PickerCategory[] = [
  {
    key: 'passing',
    label: 'Passing',
    markets: [
      {
        key: 'player_pass_yds',
        label: 'Passing Yards',
        alt: 'player_pass_yds_alternate',
      },
      {
        key: 'player_pass_tds',
        label: 'Passing TDs',
        alt: 'player_pass_tds_alternate',
      },
      { key: 'player_pass_completions', label: 'Completions' },
      { key: 'player_pass_interceptions', label: 'Interceptions' },
    ],
  },
  {
    key: 'rushing',
    label: 'Rushing',
    markets: [
      {
        key: 'player_rush_yds',
        label: 'Rushing Yards',
        alt: 'player_rush_yds_alternate',
      },
      { key: 'player_rush_attempts', label: 'Rush Attempts' },
    ],
  },
  {
    key: 'receiving',
    label: 'Receiving',
    markets: [
      {
        key: 'player_reception_yds',
        label: 'Receiving Yards',
        alt: 'player_reception_yds_alternate',
      },
      {
        key: 'player_receptions',
        label: 'Receptions',
        alt: 'player_receptions_alternate',
      },
    ],
  },
  {
    key: 'tds',
    label: 'Touchdowns',
    markets: [{ key: 'player_anytime_td', label: 'Anytime TD', yesNo: true }],
  },
  TEAM_TOTALS,
  ALT_LINES,
];

const HOCKEY: PickerCategory[] = [
  {
    key: 'points',
    label: 'Points',
    markets: [
      { key: 'player_points', label: 'Points', alt: 'player_points_alternate' },
      {
        key: 'player_assists',
        label: 'Assists',
        alt: 'player_assists_alternate',
      },
    ],
  },
  {
    key: 'goals',
    label: 'Goals',
    markets: [
      { key: 'player_goal_scorer_anytime', label: 'Anytime Goal', yesNo: true },
    ],
  },
  {
    key: 'shots',
    label: 'Shots',
    markets: [
      {
        key: 'player_shots_on_goal',
        label: 'Shots on Goal',
        alt: 'player_shots_on_goal_alternate',
      },
    ],
  },
  {
    key: 'goalie',
    label: 'Goalie',
    markets: [
      {
        key: 'player_total_saves',
        label: 'Saves',
        alt: 'player_total_saves_alternate',
      },
    ],
  },
  TEAM_TOTALS,
  ALT_LINES,
];

const BASKETBALL: PickerCategory[] = [
  {
    key: 'points',
    label: 'Points',
    markets: [
      { key: 'player_points', label: 'Points', alt: 'player_points_alternate' },
    ],
  },
  {
    key: 'rebounds',
    label: 'Rebounds',
    markets: [
      {
        key: 'player_rebounds',
        label: 'Rebounds',
        alt: 'player_rebounds_alternate',
      },
    ],
  },
  {
    key: 'assists',
    label: 'Assists',
    markets: [
      {
        key: 'player_assists',
        label: 'Assists',
        alt: 'player_assists_alternate',
      },
    ],
  },
  {
    key: 'threes',
    label: 'Threes',
    markets: [
      {
        key: 'player_threes',
        label: 'Made Threes',
        alt: 'player_threes_alternate',
      },
    ],
  },
  {
    key: 'combos',
    label: 'Combos',
    markets: [
      {
        key: 'player_points_rebounds_assists',
        label: 'Pts + Reb + Ast',
        alt: 'player_points_rebounds_assists_alternate',
      },
      {
        key: 'player_points_rebounds',
        label: 'Pts + Reb',
        alt: 'player_points_rebounds_alternate',
      },
      {
        key: 'player_points_assists',
        label: 'Pts + Ast',
        alt: 'player_points_assists_alternate',
      },
      {
        key: 'player_rebounds_assists',
        label: 'Reb + Ast',
        alt: 'player_rebounds_assists_alternate',
      },
    ],
  },
  {
    key: 'defense',
    label: 'Defense',
    markets: [
      { key: 'player_steals', label: 'Steals', alt: 'player_steals_alternate' },
      { key: 'player_blocks', label: 'Blocks', alt: 'player_blocks_alternate' },
    ],
  },
  {
    key: 'doubles',
    label: 'Doubles',
    markets: [
      { key: 'player_double_double', label: 'Double-Double', yesNo: true },
      { key: 'player_triple_double', label: 'Triple-Double', yesNo: true },
    ],
  },
  TEAM_TOTALS,
  ALT_LINES,
];

export const PICKER_CATEGORIES: Record<string, PickerCategory[]> = {
  americanfootball_nfl: FOOTBALL,
  americanfootball_ncaaf: FOOTBALL,
  basketball_nba: BASKETBALL,
  icehockey_nhl: HOCKEY,
};

/** Every non-featured market key the picker may request for a sport */
export function pickerMarketKeys(sportKey: string): Set<string> {
  const keys = new Set<string>();
  (PICKER_CATEGORIES[sportKey] ?? []).forEach((c) =>
    c.markets.forEach((m) => {
      keys.add(m.key);
      if (m.alt) keys.add(m.alt);
    })
  );
  return keys;
}

/** Yes-only props (Anytime TD, Anytime Goal): there's no other side to take */
export function isOneSidedMarket(key: string): boolean {
  return Object.values(PICKER_CATEGORIES).some((cats) =>
    cats.some((c) => c.markets.some((m) => m.key === key && m.yesNo))
  );
}

/** Display label for any picker market key, alternates included */
export function marketLabel(sportKey: string, key: string): string {
  if (key === 'h2h') return 'Moneyline';
  if (key === 'spreads') return 'Spread';
  if (key === 'totals') return 'Total';
  // From the Team Totals or Alt Lines tab alike: graded by this label
  if (key === 'team_totals' || key === 'alternate_team_totals') {
    return TEAM_TOTAL_LABEL;
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const c of PICKER_CATEGORIES[sportKey] ?? []) {
    // eslint-disable-next-line no-restricted-syntax
    for (const m of c.markets) {
      if (m.key === key || m.alt === key) return m.label;
    }
  }
  return key;
}

/** Leagues in the order the picker lists them, and their short names */
export const SPORT_ORDER = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'basketball_nba',
  'icehockey_nhl',
  'mma_mixed_martial_arts',
];
export const SPORT_TABS: Record<string, string> = {
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  basketball_nba: 'NBA',
  icehockey_nhl: 'NHL',
  mma_mixed_martial_arts: 'UFC',
};

/** Fights (UFC): two fighters, a winner, no spreads, totals or props */
export const isFight = (sportKey: string) => sportKey.startsWith('mma');

/** The game-line markets a sport offers */
export const gameMarkets = (sportKey: string): readonly string[] =>
  isFight(sportKey) ? ['h2h'] : GAME_MARKETS;

/** "Bears @ Packers", or "Buckley vs Malott" for a fight */
export const matchupLabel = (sportKey: string, away: string, home: string) =>
  `${away} ${isFight(sportKey) ? 'vs' : '@'} ${home}`;
