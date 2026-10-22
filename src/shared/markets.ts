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
  ALT_LINES,
];

export const PICKER_CATEGORIES: Record<string, PickerCategory[]> = {
  americanfootball_nfl: FOOTBALL,
  americanfootball_ncaaf: FOOTBALL,
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
  // eslint-disable-next-line no-restricted-syntax
  for (const c of PICKER_CATEGORIES[sportKey] ?? []) {
    // eslint-disable-next-line no-restricted-syntax
    for (const m of c.markets) {
      if (m.key === key || m.alt === key) return m.label;
    }
  }
  return key;
}
