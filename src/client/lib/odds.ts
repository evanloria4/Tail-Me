import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from './api';
import type { EventMarkets, OddsGame } from '../../shared/markets';

// Live odds for the bet picker. The server caches against the Odds API; this
// remembers responses for the page session so tab-hopping doesn't refetch.
const CLIENT_TTL = 2 * 60_000;
const memo = new Map<string, { at: number; data: unknown }>();

type Loadable<T> = { data: T | null; loading: boolean; error: string | null };

function useCachedGet<T>(url: string | null): Loadable<T> {
  const fresh = url ? memo.get(url) : undefined;
  const initial =
    fresh && Date.now() - fresh.at < CLIENT_TTL ? (fresh.data as T) : null;
  const [state, setState] = useState<Loadable<T>>({
    data: initial,
    loading: Boolean(url) && !initial,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const hit = memo.get(url);
    if (hit && Date.now() - hit.at < CLIENT_TTL) {
      setState({ data: hit.data as T, loading: false, error: null });
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get<T>(url)
      .then(({ data }) => {
        memo.set(url, { at: Date.now(), data });
        if (live) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (live)
          setState({
            data: null,
            loading: false,
            error: apiErrorMessage(err, 'Could not load odds'),
          });
      });
    return () => {
      live = false;
    };
  }, [url]);

  return state;
}

/** A league's games; an empty sport key loads nothing */
export const useGames = (sportKey: string) =>
  useCachedGet<OddsGame[]>(sportKey ? `/odds/${sportKey}/games` : null);

/** Props / alt lines for a game; pass null markets to skip loading */
export const useEventMarkets = (
  sportKey: string,
  eventId: string,
  markets: string[] | null
) =>
  useCachedGet<EventMarkets>(
    markets?.length
      ? `/odds/${sportKey}/events/${eventId}?markets=${markets.join(',')}`
      : null
  );
