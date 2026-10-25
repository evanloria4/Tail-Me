import React, { useState } from 'react';
import api, { apiErrorMessage } from '../lib/api';
import { Selection, toSelection } from '../lib/slip';
import useNow from '../lib/useNow';
import { matchupLabel, SPORT_ORDER, SPORT_TABS } from '../../shared/markets';
import type { ImportGame, SlipImportResult } from '../../shared/slipImport';
import { inSiteZone, SITE_ZONE_LABEL } from '../../shared/time';
import { inputClass } from './ComposerParts';
import { LiveBadge } from './SlipParts';

// "Paste a FanDuel link": builds the slip from a bet slip someone shared out
// of the FanDuel app. Most picks are found on their own; anything the server
// couldn't place, the poster finds by tapping the game it's from (that loads
// the game's markets). The tap-a-game step has to be unmissable.

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
        className="group flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-emerald-500/10 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 truncate font-semibold">
          {matchupLabel(game.sportKey, game.awayTeam, game.homeTeam)}
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
        <span className="shrink-0 rounded-md border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-400 transition group-hover:bg-emerald-500 group-hover:text-gray-950">
          Add it ›
        </span>
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
  /** The game being checked right now */
  const [looking, setLooking] = useState<string | null>(null);
  /** The last tapped game held a missing pick (and some are still missing) */
  const [justFound, setJustFound] = useState(false);
  const now = useNow();

  const reset = () => {
    setOpen(false);
    setLink('');
    setEventIds([]);
    setResult(null);
    setError(null);
    setQuery('');
    setMissedGame(null);
    setLooking(null);
    setJustFound(false);
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
        tried && !gained
          ? matchupLabel(tried.sportKey, tried.awayTeam, tried.homeTeam)
          : null
      );
      if (gained) setQuery('');
      setJustFound(!!tried && gained);
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
      setLooking(null);
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
            Found {result.picks.length} of {result.total} legs
            <span className="font-normal text-gray-500">
              {' '}
              · {missing} to add
            </span>
          </p>
          {result.games.length > 0 ? (
            <>
              <div className="mt-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
                <p className="font-semibold text-emerald-400">
                  <span aria-hidden="true">👆 </span>
                  One tap: pick the game, we add the bet
                </p>
                <p className="mt-0.5 text-sm text-gray-300">
                  No need to find the bet yourself. Tap the game{' '}
                  {missing === 1
                    ? 'the missing leg is'
                    : 'the missing legs are'}{' '}
                  from and {missing === 1 ? 'it lands' : 'they land'} on your
                  slip.
                  {missing > 1 &&
                    ' Legs from different games? One tap on each.'}
                </p>
              </div>
              <div aria-live="polite" className="mt-2 text-sm">
                {looking && (
                  <p className="text-gray-400">Looking in {looking}…</p>
                )}
                {!looking && justFound && (
                  <p className="font-semibold text-emerald-400">
                    ✓ Added! {missing} more: one tap on{' '}
                    {missing === 1 ? 'its' : 'their'} game.
                  </p>
                )}
                {!looking && missedGame && (
                  <p className="text-yellow-300">
                    Not in {missedGame}. Try another game.
                  </p>
                )}
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a team, e.g. Lions"
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
                          onPick={() => {
                            setLooking(
                              matchupLabel(g.sportKey, g.awayTeam, g.homeTeam)
                            );
                            run([...eventIds, g.id]);
                          }}
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
