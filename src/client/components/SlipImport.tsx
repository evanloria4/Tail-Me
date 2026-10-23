import React, { useState } from 'react';
import api, { apiErrorMessage } from '../lib/api';
import { Selection, toSelection } from '../lib/slip';
import useNow from '../lib/useNow';
import { SPORT_ORDER, SPORT_TABS } from '../../shared/markets';
import type { ImportGame, SlipImportResult } from '../../shared/slipImport';
import { inSiteZone, SITE_ZONE_LABEL } from '../../shared/time';
import { inputClass } from './ComposerParts';
import { LiveBadge } from './SlipParts';

// "Paste a FanDuel link": builds the slip from a bet slip someone shared out
// of the FanDuel app. Game lines match straight away; props need their game,
// so the poster taps which game the rest are from (that loads its props).

function GameRow({
  game,
  now,
  onPick,
  disabled,
}: {
  game: ImportGame;
  now: number;
  onPick: () => void;
  disabled: boolean;
}) {
  const started = new Date(game.commenceTime).getTime() <= now;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-gray-800 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 truncate font-semibold">
          {game.awayTeam} @ {game.homeTeam}
        </span>
        {started ? (
          <LiveBadge />
        ) : (
          <span className="shrink-0 text-xs text-gray-500">
            {new Date(game.commenceTime).toLocaleString(
              'en-US',
              inSiteZone({
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })
            )}{' '}
            {SITE_ZONE_LABEL}
          </span>
        )}
      </button>
    </li>
  );
}

export default function SlipImport({
  bookName,
  onPicks,
  onDone,
}: {
  bookName: string;
  /** Matched picks to add to the slip (already-picked ones are skipped) */
  onPicks: (picks: Selection[]) => void;
  /** Finished: go review whatever's on the slip */
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [result, setResult] = useState<SlipImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** The game just tried that had none of the missing picks */
  const [missedGame, setMissedGame] = useState<string | null>(null);
  const now = useNow();

  const reset = () => {
    setOpen(false);
    setLink('');
    setEventIds([]);
    setResult(null);
    setError(null);
    setQuery('');
    setMissedGame(null);
  };

  const run = async (ids: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<SlipImportResult>('/odds/import', {
        link,
        eventIds: ids,
      });
      const tried = result?.games.find((g) => g.id === ids[ids.length - 1]);
      const gained = data.picks.length > (result?.picks.length ?? 0);
      setMissedGame(
        tried && !gained ? `${tried.awayTeam} @ ${tried.homeTeam}` : null
      );
      if (gained) setQuery('');
      setEventIds(data.searched);
      onPicks(
        data.picks.map((p) => toSelection(p.game, p.marketKey, p.outcome))
      );
      if (data.picks.length === data.total) {
        reset();
        onDone();
        return;
      }
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not read that link'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-700 px-3 py-2 text-left text-sm font-semibold text-gray-300 transition hover:border-emerald-500 hover:text-emerald-400"
      >
        <span aria-hidden="true">📋</span>
        Paste a {bookName} link
        <span className="ml-auto text-xs font-normal text-gray-500">
          skip the picking
        </span>
      </button>
    );
  }

  const missing = result ? result.total - result.picks.length : 0;
  // Games left to try, by league (NFL first), narrowed by the team search
  const q = query.trim().toLowerCase();
  const groups = SPORT_ORDER.map(
    (sport) =>
      [
        sport,
        (result?.games ?? []).filter(
          (g) =>
            g.sportKey === sport &&
            (!q ||
              g.awayTeam.toLowerCase().includes(q) ||
              g.homeTeam.toLowerCase().includes(q))
        ),
      ] as const
  ).filter(([, games]) => games.length);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      {!result ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run([]);
          }}
        >
          <label htmlFor="slip-import" className="text-sm font-semibold">
            Paste your {bookName} bet slip link
          </label>
          <p className="mt-0.5 text-xs text-gray-500">
            In the {bookName} app, tap Share on your bet slip and copy the link.
            Picks come in at {bookName}&apos;s current odds; fix yours after
            posting with ⋯ → Change odds.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              id="slip-import"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(null);
              }}
              placeholder="https://sportsbook.fanduel.com/addToBetslip?…"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={loading || !link.trim()}
              className="shrink-0 rounded-lg bg-emerald-500 px-4 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Finding picks…' : 'Import'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-sm font-semibold">
            Found {result.picks.length} of {result.total} picks
          </p>
          {result.games.length > 0 ? (
            <>
              <p className="mt-0.5 text-xs text-gray-500">
                {result.picks.length === 0 && `They look like props. `}
                {result.picks.length > 0 &&
                  (missing === 1
                    ? 'The last one looks like a prop. '
                    : `The other ${missing} look like props. `)}
                Which game {missing === 1 ? 'is it' : 'are they'} from?
              </p>
              {missedGame && (
                <p className="mt-1 text-xs text-yellow-300">
                  Not in {missedGame}. Try another game.
                </p>
              )}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams"
                aria-label="Search games by team"
                className={`${inputClass} mt-2`}
              />
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-800">
                {groups.map(([sport, games]) => (
                  <section key={sport}>
                    <h3 className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      {SPORT_TABS[sport] ?? sport}
                    </h3>
                    <ul className="divide-y divide-gray-800">
                      {games.map((g) => (
                        <GameRow
                          key={g.id}
                          game={g}
                          now={now}
                          disabled={loading}
                          onPick={() => run([...eventIds, g.id])}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {!groups.length && (
                  <p className="px-3 py-3 text-sm text-gray-500">
                    No games match “{query}”.
                  </p>
                )}
              </div>
              {loading && (
                <p className="mt-2 text-xs text-gray-500">Looking…</p>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">
              {bookName} isn&apos;t listing the rest anymore (the game may be
              over). Add {missing === 1 ? 'it' : 'them'} by hand if you can.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="mt-2 flex justify-end text-sm">
        {/* Picks found so far stay on the slip; the picker's below */}
        <button
          type="button"
          onClick={reset}
          className={
            result
              ? 'font-semibold text-emerald-400 hover:underline'
              : 'text-gray-500 hover:text-white'
          }
        >
          {result ? 'Pick the rest by hand' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
