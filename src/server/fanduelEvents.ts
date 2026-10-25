// Which game a pasted FanDuel pick belongs to. Share links carry only
// marketId + selectionId, and FanDuel numbers markets per state, so a
// market id can't be looked up. Selection ids are the same everywhere,
// though (a player, a team), so a game's own FanDuel page tells us which
// selections it has. This reads FanDuel's public event page (the endpoint
// its site calls; unofficial and login-free, so it can change or close at
// any time) and costs no Odds API credits. Callers treat failure as "no
// hint" and fall back to asking which game.
import axios from 'axios';

const EVENT_PAGE = 'https://sbapi.nj.sportsbook.fanduel.com/api/event-page';
/** The public app key FanDuel's own site sends */
const APP_KEY = 'FhMFpcPWXMeyZxOx';
const TTL = 10 * 60_000;
const MAX_CACHED = 300;
/** Tabs with nothing our picker offers (period lines, specials, parlays) */
const SKIP_TABS = /quarter|half|period|inning|parlay|quick bets|special/i;

/** FanDuel's game id from its page link, e.g. "…-saints-35605985" */
export function fanduelEventId(link: string | undefined): string | null {
  return link?.match(/-(\d{5,12})(?:[/?#]|$)/)?.[1] ?? null;
}

const tabSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/™/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type EventPage = {
  layout?: { tabs?: Record<string, { title?: string }> };
  attachments?: {
    markets?: Record<string, { runners?: { selectionId?: number }[] }>;
  };
};

async function getPage(eventId: string, tab?: string): Promise<EventPage> {
  const { data } = await axios.get<EventPage>(EVENT_PAGE, {
    params: { _ak: APP_KEY, eventId, ...(tab && { tab }) },
    timeout: 6_000,
    headers: { Accept: 'application/json' },
  });
  return data;
}

const selectionsOf = (page: EventPage | null) =>
  Object.values(page?.attachments?.markets ?? {}).flatMap((m) =>
    (m.runners ?? []).flatMap((r) =>
      r.selectionId == null ? [] : [String(r.selectionId)]
    )
  );

const cache = new Map<
  string,
  { expires: number; value: Promise<Set<string>> }
>();

/**
 * Every selection id on a FanDuel game's page (its prop and alt-line tabs).
 * Cached 10 minutes per game; a failed tab is skipped, a failed game gives
 * an empty set.
 */
export function eventSelections(eventId: string): Promise<Set<string>> {
  const hit = cache.get(eventId);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = (async () => {
    try {
      const first = await getPage(eventId);
      const tabs = Object.values(first.layout?.tabs ?? {})
        .map((t) => t.title ?? '')
        .filter((t) => t && !SKIP_TABS.test(t));
      const pages = await Promise.all(
        tabs.map((t) => getPage(eventId, tabSlug(t)).catch(() => null))
      );
      return new Set([first, ...pages].flatMap(selectionsOf));
    } catch (err) {
      console.error(
        `FanDuel event page failed for ${eventId}`,
        axios.isAxiosError(err) ? err.response?.status : err
      );
      return new Set<string>();
    }
  })();
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(eventId, { expires: Date.now() + TTL, value });
  return value;
}
