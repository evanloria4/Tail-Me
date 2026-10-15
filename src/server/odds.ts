// The Odds API client with an in-memory cache. Credits are scarce (shared key),
// so game lines are cached per league, and event markets are cached per market
// so a category only pays for what isn't cached yet. Odds come from one book
// (LIVE_ODDS_BOOK) for now.
import axios, { isAxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import prisma from './db';
import type {
  BookOdds,
  EventMarkets,
  OddsGame,
  OddsOutcome,
} from '../shared/markets';
import { GAME_MARKETS, LIVE_ODDS_BOOK } from '../shared/markets';

const BASE_URL = 'https://api.the-odds-api.com/v4';

// In development (nodemon.json sets NODE_ENV) odds are kept for a day and
// saved to disk, so server restarts while coding don't spend credits.
const DEV = process.env.NODE_ENV === 'development';
const DAY = 24 * 60 * 60_000;
const GAMES_TTL = DEV ? DAY : 5 * 60_000;
const MARKET_TTL = DEV ? DAY : 10 * 60_000;
const DISK_DIR = path.resolve(__dirname, '..', '..', '.cache', 'odds');

export class OddsUnavailableError extends Error {}

type ApiOutcome = {
  name: string;
  description?: string;
  price: number;
  point?: number;
  link?: string | null;
  sid?: string | null;
};
type ApiBookmaker = {
  key: string;
  link?: string | null;
  markets: { key: string; outcomes: ApiOutcome[] }[];
};
type ApiEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: ApiBookmaker[];
};

// ---------- Tiny TTL cache (dedupes concurrent requests too) ----------

type Entry<T> = { expires: number; value: Promise<T> };
const cache = new Map<string, Entry<unknown>>();

const diskFile = (key: string) =>
  path.join(DISK_DIR, `${key.replace(/[^a-z0-9_-]/gi, '_')}.json`);

/** A fresh cache entry, falling back to the dev disk cache after a restart */
function peek<T>(key: string): Entry<T> | undefined {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit;
  if (!DEV) return undefined;
  try {
    const saved = JSON.parse(fs.readFileSync(diskFile(key), 'utf8')) as {
      expires: number;
      value: T;
    };
    if (saved.expires <= Date.now()) return undefined;
    const entry = {
      expires: saved.expires,
      value: Promise.resolve(saved.value),
    };
    cache.set(key, entry);
    return entry;
  } catch {
    return undefined;
  }
}

function cached<T>(key: string, ttl: number, load: () => Promise<T>) {
  const hit = peek<T>(key);
  if (hit) return hit.value;
  const expires = Date.now() + ttl;
  const value = load();
  cache.set(key, { expires, value });
  // Never cache a failure
  value.catch(() => cache.delete(key));
  if (DEV) {
    value
      .then((v) =>
        fs.promises
          .mkdir(DISK_DIR, { recursive: true })
          .then(() =>
            fs.promises.writeFile(
              diskFile(key),
              JSON.stringify({ expires, value: v })
            )
          )
      )
      .catch(() => {});
  }
  return value;
}

// ---------- Requests ----------

let creditsRemaining: number | null = null;
export const oddsCreditsRemaining = () => creditsRemaining;

async function request<T>(endpoint: string, params: Record<string, string>) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new OddsUnavailableError('Live odds are not configured');
  try {
    const res = await axios.get<T>(`${BASE_URL}${endpoint}`, {
      params: {
        apiKey,
        oddsFormat: 'american',
        includeLinks: 'true',
        includeSids: 'true',
        ...params,
      },
      timeout: 15_000,
    });
    const remaining = Number(res.headers['x-requests-remaining']);
    if (!Number.isNaN(remaining)) creditsRemaining = remaining;
    return res.data;
  } catch (err) {
    const status = isAxiosError(err) ? err.response?.status : undefined;
    console.error(`Odds API ${endpoint} failed`, status ?? err);
    throw new OddsUnavailableError(
      status === 401 || status === 429
        ? 'Live odds are temporarily unavailable'
        : 'Could not load live odds'
    );
  }
}

/** Books live odds come from (`bookmakers` param). Adding up to 10 costs nothing extra. */
const bookmakerKeys = async () => LIVE_ODDS_BOOK;

function toOutcome(o: ApiOutcome): OddsOutcome {
  return {
    name: o.name,
    ...(o.description ? { player: o.description } : {}),
    ...(o.point != null ? { point: o.point } : {}),
    price: o.price,
    ...(o.link ? { link: o.link } : {}),
    ...(o.sid ? { sid: o.sid } : {}),
  };
}

function toBooks(bookmakers: ApiBookmaker[]): Record<string, BookOdds> {
  return Object.fromEntries(
    bookmakers.map((b) => [
      b.key,
      {
        ...(b.link ? { link: b.link } : {}),
        markets: Object.fromEntries(
          b.markets.map((m) => [m.key, m.outcomes.map(toOutcome)])
        ),
      },
    ])
  );
}

// ---------- Public API ----------

/** Upcoming + live games with spreads, totals and moneylines at every book */
export function getGames(sportKey: string): Promise<OddsGame[]> {
  return cached(`games:${sportKey}`, GAMES_TTL, async () => {
    const events = await request<ApiEvent[]>(`/sports/${sportKey}/odds`, {
      bookmakers: await bookmakerKeys(),
      markets: GAME_MARKETS.join(','),
    });

    // Keep Event rows current so posted legs can reference them
    await Promise.all(
      events.map((e) => {
        const data = {
          sportKey: e.sport_key,
          homeTeam: e.home_team,
          awayTeam: e.away_team,
          commenceTime: new Date(e.commence_time),
        };
        return prisma.event.upsert({
          where: { id: e.id },
          update: data,
          create: { id: e.id, ...data },
        });
      })
    );

    return events
      .map((e) => ({
        id: e.id,
        sportKey: e.sport_key,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        commenceTime: e.commence_time,
        books: toBooks(e.bookmakers),
      }))
      .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
  });
}

type MarketSlice = {
  eventLinks: Record<string, string>;
  byBook: Record<string, OddsOutcome[]>;
};

/**
 * Player props / alternate lines for one game. Each market is cached on its
 * own, and one request fetches whichever of `marketKeys` aren't cached yet.
 */
export async function getEventMarkets(
  sportKey: string,
  eventId: string,
  marketKeys: string[]
): Promise<EventMarkets> {
  const key = (m: string) => `event:${eventId}:${m}`;
  const missing = marketKeys.filter((m) => !peek(key(m)));

  if (missing.length) {
    const fetched = (async () => {
      const event = await request<ApiEvent>(
        `/sports/${sportKey}/events/${eventId}/odds`,
        { bookmakers: await bookmakerKeys(), markets: missing.join(',') }
      );
      return toBooks(event.bookmakers);
    })();
    // A market no book offers is cached as empty, so it isn't asked for again
    missing.forEach((m) =>
      cached<MarketSlice>(key(m), MARKET_TTL, async () => {
        const books = await fetched;
        const slice: MarketSlice = { eventLinks: {}, byBook: {} };
        Object.entries(books).forEach(([book, odds]) => {
          if (odds.link) slice.eventLinks[book] = odds.link;
          if (odds.markets[m]) slice.byBook[book] = odds.markets[m];
        });
        return slice;
      })
    );
  }

  const slices = await Promise.all(
    marketKeys.map((m) => (cache.get(key(m)) as Entry<MarketSlice>).value)
  );

  const books: Record<string, BookOdds> = {};
  slices.forEach((slice, i) => {
    Object.entries(slice.byBook).forEach(([book, outcomes]) => {
      books[book] ??= { link: slice.eventLinks[book], markets: {} };
      books[book].markets[marketKeys[i]] = outcomes;
    });
  });
  return { eventId, books };
}
