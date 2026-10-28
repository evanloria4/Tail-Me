import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useEventMarkets, useGames } from '../lib/odds';
import { Selection, selectionKey } from '../lib/slip';
import { isValidAmerican } from '../../shared/odds';
import {
  marketLabel,
  matchupLabel,
  PICKER_CATEGORIES,
  SPORT_ORDER,
  SPORT_TABS,
  TEAM_TOTAL_LABEL,
  type OddsOutcome,
} from '../../shared/markets';
import { inputClass } from './ComposerParts';
import { useDismiss } from './SlipSocial';

// A leg typed on the review step, for a line FanDuel has that our odds feed
// doesn't (usually an alt number). The game is any listed one (the slip's
// come first) and the player is from the book's list for that market, never
// typed, so the leg is stored like a picked one and the grader always finds
// it in ESPN's data. It has no betslip link, so Tail lists it with an Add
// link to the book.

type Market = {
  key: string;
  label: string;
  /** Who it's on: the teams (spreads, team totals), a player, or nobody */
  who: 'teams' | 'player' | 'none';
};

/** The markets a custom leg can be on: lines with a number, no Yes props */
function customMarkets(sportKey: string): Market[] {
  const categories = PICKER_CATEGORIES[sportKey] ?? [];
  if (!categories.length) return []; // fights are moneyline only
  const props = categories
    .filter((c) => !c.game)
    .flatMap((c) => c.markets)
    .filter((m) => !m.yesNo && m.label !== TEAM_TOTAL_LABEL)
    .map((m): Market => ({ key: m.key, label: m.label, who: 'player' }));
  return [
    { key: 'spreads', label: 'Spread', who: 'teams' },
    { key: 'totals', label: 'Total', who: 'none' },
    { key: 'team_totals', label: TEAM_TOTAL_LABEL, who: 'teams' },
    ...props,
  ];
}

/** Leagues a custom leg can be on (fights are moneyline only) */
const SPORTS = SPORT_ORDER.filter((k) => customMarkets(k).length > 0);

const labelClass = 'mb-1 block text-xs font-medium text-gray-400';
const fieldClass = `${inputClass} py-2 text-sm`;

type Option = { value: string; label: string; note?: string };

/**
 * A labeled dropdown drawn by the app, not the browser (a native select's
 * list can't be styled): a field showing the pick, and a list under it with
 * the current one checked. Arrows move, Enter picks, Escape closes.
 */
function Select({
  label,
  value,
  options,
  onChange,
  empty = 'None listed',
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  /** Shown when there's nothing to pick */
  empty?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const current = options.find((o) => o.value === value);

  const show = () => {
    setActive(Math.max(0, options.indexOf(current ?? options[0])));
    setOpen(true);
  };
  const pick = (o: Option) => {
    onChange(o.value);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      // Close the list, not the composer behind it
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) show();
      else {
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => Math.min(options.length - 1, Math.max(0, i + step)));
      }
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (options[active]) pick(options[active]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <span id={`${id}-label`} className={labelClass}>
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={!options.length}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`${fieldClass} flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:text-gray-500`}
      >
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
          {current?.label ?? empty}
          {current?.note && (
            <span className="ml-1.5 text-xs text-emerald-400">
              {current.note}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-4 w-4 flex-none text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 py-1 shadow-xl"
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    i === active ? 'bg-gray-800' : ''
                  } ${selected ? 'font-semibold text-emerald-400' : 'text-white'}`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {o.label}
                    {o.note && (
                      <span className="ml-1.5 text-xs font-normal text-emerald-400">
                        {o.note}
                      </span>
                    )}
                  </span>
                  {selected && <span aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A row of options with one picked (league, side) */
function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1 rounded-lg bg-gray-950 p-1"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm font-semibold transition ${
              value === o.value
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CustomLeg({
  selections,
  onAdd,
  onClose,
}: {
  selections: Selection[];
  onAdd: (selection: Selection) => void;
  onClose: () => void;
}) {
  // Any game in any league; it starts on the slip's first game
  const slipGame = selections.find(
    (s) => s.eventId && SPORTS.includes(s.sportKey)
  );
  const [sportKey, setSportKey] = useState(slipGame?.sportKey ?? SPORTS[0]);
  const [eventId, setEventId] = useState(slipGame?.eventId ?? '');
  const onSlip = useMemo(
    () => new Set(selections.map((s) => s.eventId)),
    [selections]
  );
  // The league's games (the picker's cached list), slip games first
  const { data: list, loading: listLoading } = useGames(sportKey);
  const games = useMemo(
    () =>
      [...(list ?? [])].sort(
        (a, b) => Number(onSlip.has(b.id)) - Number(onSlip.has(a.id))
      ),
    [list, onSlip]
  );
  const full = games.find((g) => g.id === eventId) ?? games[0];
  const game = full && {
    eventId: full.id,
    sportKey: full.sportKey,
    eventLabel: matchupLabel(full.sportKey, full.awayTeam, full.homeTeam),
    commenceTime: full.commenceTime,
  };
  const teams = full ? [full.awayTeam, full.homeTeam] : [];

  const markets = customMarkets(sportKey);
  const [marketKey, setMarketKey] = useState(markets[0]?.key ?? '');
  const market = markets.find((m) => m.key === marketKey) ?? markets[0];
  const [who, setWho] = useState('');
  const [side, setSide] = useState('');
  const [line, setLine] = useState('');
  const [odds, setOdds] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lineId = useId();
  const oddsId = useId();

  // Players: whoever the book lists for this market in this game
  const playerMarket = market?.who === 'player' ? market.key : null;
  const propKeys = useMemo(() => {
    if (!playerMarket) return null;
    const def = (PICKER_CATEGORIES[sportKey] ?? [])
      .flatMap((c) => c.markets)
      .find((m) => m.key === playerMarket);
    return def?.alt ? [def.key, def.alt] : [playerMarket];
  }, [playerMarket, sportKey]);
  const props = useEventMarkets(
    game?.sportKey ?? '',
    game?.eventId ?? '',
    propKeys
  );
  const players = useMemo(() => {
    if (!propKeys) return [];
    const books = props.data?.books ?? {};
    const names = Object.values(books).flatMap((b) =>
      propKeys.flatMap((k) => (b.markets[k] ?? []).map((o) => o.player))
    );
    return [...new Set(names.filter((n): n is string => !!n))].sort();
  }, [props.data, propKeys]);

  const header = (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Custom leg
      </p>
      {/* Cancel up top too, so it's in reach mid-form */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancel custom leg"
        className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-800 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
  const leaguePicker = (
    <Segmented
      label="League"
      options={SPORTS.map((k) => ({ value: k, label: SPORT_TABS[k] ?? k }))}
      value={sportKey}
      onChange={(k) => {
        setSportKey(k);
        setEventId('');
        setMarketKey('');
        setWho('');
        setSide('');
      }}
    />
  );
  const cardClass = 'space-y-3 rounded-xl border border-gray-800 p-3';

  if (!game || !market) {
    return (
      <div className={cardClass}>
        {header}
        {leaguePicker}
        <p className="text-sm text-gray-500">
          {listLoading ? 'Loading games…' : 'No games listed right now.'}
        </p>
      </div>
    );
  }

  let choices: string[] = [];
  if (market.who === 'teams') choices = teams;
  else if (market.who === 'player') choices = players;
  const pickedWho = choices.includes(who) ? who : (choices[0] ?? '');
  const sides = market.key === 'spreads' ? teams : ['Over', 'Under'];
  const pickedSide = sides.includes(side) ? side : sides[0];

  const add = () => {
    const point = Number(line);
    const price = Number(odds.trim().replace(/^\+/, ''));
    if (market.who !== 'none' && !pickedWho) {
      setError(
        market.who === 'player'
          ? 'Nobody is listed for this market yet'
          : 'Could not load the teams'
      );
      return;
    }
    if (!pickedSide) {
      setError('Could not load the teams');
      return;
    }
    if (line.trim() === '' || !Number.isFinite(point)) {
      setError('Enter the line');
      return;
    }
    if (!isValidAmerican(price)) {
      setError('Odds look like +150 or -120');
      return;
    }
    // Team totals ride the prop path with the team as the "player"
    const player =
      market.who === 'player' || market.key === 'team_totals'
        ? pickedWho
        : undefined;
    const outcome: OddsOutcome = {
      name: pickedSide,
      point,
      price,
      ...(player ? { player } : {}),
    };
    onAdd({
      key: selectionKey(game.eventId, market.key, outcome),
      sportKey: game.sportKey,
      eventId: game.eventId,
      eventLabel: game.eventLabel,
      marketKey: market.key,
      marketLabel: marketLabel(game.sportKey, market.key),
      outcome,
      ...(game.commenceTime ? { commenceTime: game.commenceTime } : {}),
    });
  };

  // Sits inside the review form, so it can't be a form itself: Enter in a
  // box adds the leg here instead of posting the slip
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
  };

  let whoField: React.ReactNode = null;
  if (market.who === 'player' && props.loading) {
    whoField = <p className="text-sm text-gray-500">Loading players…</p>;
  } else if (market.who !== 'none') {
    whoField = (
      <Select
        label={market.who === 'player' ? 'Player' : 'Team'}
        value={pickedWho}
        options={choices.map((c) => ({ value: c, label: c }))}
        onChange={setWho}
      />
    );
  }

  return (
    <div role="group" aria-label="Custom leg" className={cardClass}>
      {header}
      {leaguePicker}
      <Select
        label="Game"
        value={game.eventId}
        options={games.map((g) => ({
          value: g.id,
          label: matchupLabel(g.sportKey, g.awayTeam, g.homeTeam),
          ...(onSlip.has(g.id) ? { note: 'On slip' } : {}),
        }))}
        onChange={(id) => {
          setEventId(id);
          setWho('');
          setSide('');
        }}
      />
      <Select
        label="Market"
        value={market.key}
        options={markets.map((m) => ({ value: m.key, label: m.label }))}
        onChange={(key) => {
          setMarketKey(key);
          setWho('');
          setSide('');
        }}
      />
      {whoField}
      <Segmented
        label="Side"
        options={sides.map((s) => ({ value: s, label: s }))}
        value={pickedSide}
        onChange={setSide}
      />
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={lineId} className="block">
          <span className={labelClass}>Line</span>
          <input
            id={lineId}
            inputMode="decimal"
            placeholder={market.key === 'spreads' ? '-6.5' : '287.5'}
            value={line}
            onKeyDown={onEnter}
            onChange={(e) => {
              setLine(e.target.value);
              setError(null);
            }}
            className={fieldClass}
          />
        </label>
        <label htmlFor={oddsId} className="block">
          <span className={labelClass}>Odds</span>
          <input
            id={oddsId}
            inputMode="numeric"
            placeholder="+150"
            value={odds}
            onKeyDown={onEnter}
            onChange={(e) => {
              setOdds(e.target.value);
              setError(null);
            }}
            className={fieldClass}
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-700 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={add}
          className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-gray-950 hover:bg-emerald-400"
        >
          Add leg
        </button>
      </div>
    </div>
  );
}
