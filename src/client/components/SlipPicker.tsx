import React, { useEffect, useMemo, useState } from 'react';
import api, { apiErrorMessage } from '../lib/api';
import { useEventMarkets, useGames } from '../lib/odds';
import useMeta from '../lib/useMeta';
import {
  buildPost,
  canLadder,
  isSameGame,
  legToSelection,
  matchesPick,
  Selection,
  selectionKey,
  selectionTitle,
  slipDecimal,
  SlipMode,
  toLeg,
} from '../lib/slip';
import {
  formatAmerican,
  formatMoney,
  isValidAmerican,
  americanToDecimal,
  decimalToAmerican,
  parlayDecimal,
  payout,
} from '../../shared/odds';
import {
  LIVE_ODDS_BOOK,
  marketLabel,
  OddsGame,
  OddsOutcome,
  PickerCategory,
  PICKER_CATEGORIES,
} from '../../shared/markets';
import {
  createPostSchema,
  editPostSchema,
  type FeedPost,
} from '../../shared/posts';
import { inputClass } from './ComposerParts';
import { inSiteZone, SITE_ZONE_LABEL } from '../../shared/time';
import GroupReview, { GroupMode, PostedKind } from './GroupReview';
import SeriesPicker from './SeriesPicker';
import { LiveBadge } from './SlipParts';
import useNow from '../lib/useNow';

// Sportsbook-style bet picker: choose a league, tap prices to build a
// slip, then review and post. Prices, lines and add-to-betslip links all come
// from live odds, so nothing has to be typed in.

const SPORT_ORDER = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'icehockey_nhl',
];
const SPORT_TABS: Record<string, string> = {
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  icehockey_nhl: 'NHL',
};
const MAX_PICKS = 20;

type Toggle = (game: OddsGame, marketKey: string, o: OddsOutcome) => void;
type IsPicked = (game: OddsGame, marketKey: string, o: OddsOutcome) => boolean;

const eventLabelOf = (g: OddsGame) => `${g.awayTeam} @ ${g.homeTeam}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const started = (iso: string, now: number) => new Date(iso).getTime() <= now;

/** Kickoff time, or the LIVE chip once the game's on (its odds are in-game) */
function GameTime({ iso }: { iso: string }) {
  const now = useNow();
  if (started(iso, now)) return <LiveBadge />;
  const when = new Date(iso).toLocaleString(
    'en-US',
    inSiteZone({ weekday: 'short', hour: 'numeric', minute: '2-digit' })
  );
  return (
    <span className="text-gray-500">
      {when} {SITE_ZONE_LABEL}
    </span>
  );
}

// ---------- Small pieces ----------

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-emerald-500 bg-emerald-500 text-gray-950'
          : 'border-gray-800 text-gray-300 hover:border-gray-600 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function OddsButton({
  line,
  outcome,
  picked,
  onClick,
}: {
  line?: string;
  outcome?: OddsOutcome;
  picked?: boolean;
  onClick?: () => void;
}) {
  if (!outcome) {
    return (
      <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-gray-800 text-gray-600">
        —
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      className={`flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border px-1 text-sm transition ${
        picked
          ? 'border-emerald-500 bg-emerald-500 text-gray-950'
          : 'border-gray-800 bg-gray-900 hover:border-gray-600'
      }`}
    >
      {line && (
        <span
          className={`truncate text-xs ${picked ? 'opacity-80' : 'text-gray-400'}`}
        >
          {line}
        </span>
      )}
      <span className="font-bold tabular-nums">
        {formatAmerican(outcome.price)}
      </span>
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-gray-500">{children}</p>;
}

// ---------- Game lines board ----------

function GameBoard({
  game,
  book,
  toggle,
  isPicked,
}: {
  game: OddsGame;
  book: string;
  toggle: Toggle;
  isPicked: IsPicked;
}) {
  const markets = game.books[book]?.markets ?? {};
  const find = (key: string, name: string) =>
    markets[key]?.find((o) => o.name === name);

  const row = (team: string, totalSide: 'Over' | 'Under') => {
    const spread = find('spreads', team);
    const total = find('totals', totalSide);
    const ml = find('h2h', team);
    const cell = (key: string, o: OddsOutcome | undefined, line?: string) => (
      <OddsButton
        line={line}
        outcome={o}
        picked={o ? isPicked(game, key, o) : false}
        onClick={o ? () => toggle(game, key, o) : undefined}
      />
    );
    return (
      <>
        <p className="truncate text-sm font-semibold" title={team}>
          {team}
        </p>
        {cell('spreads', spread, spread && signed(spread.point ?? 0))}
        {cell(
          'totals',
          total,
          total && `${totalSide === 'Over' ? 'O' : 'U'} ${total.point}`
        )}
        {cell('h2h', ml)}
      </>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,4.25rem)] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_repeat(3,5.25rem)]">
      <span />
      {['Spread', 'Total', 'Money'].map((h) => (
        <span
          key={h}
          className="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
        >
          {h}
        </span>
      ))}
      {row(game.awayTeam, 'Over')}
      {row(game.homeTeam, 'Under')}
    </div>
  );
}

function GamesList({
  sportKey,
  book,
  bookName,
  toggle,
  isPicked,
  onOpen,
  onlyGameId,
}: {
  sportKey: string;
  book: string;
  bookName: string;
  toggle: Toggle;
  isPicked: IsPicked;
  onOpen: (game: OddsGame) => void;
  /** Show just this game (one-game group parlays) */
  onlyGameId?: string;
}) {
  const { data: all, loading, error } = useGames(sportKey);
  const games = onlyGameId ? all?.filter((g) => g.id === onlyGameId) : all;
  // One-game group parlay: skip the list and open the game itself
  const only = onlyGameId ? games?.[0] : undefined;
  useEffect(() => {
    if (only) onOpen(only);
  }, [only, onOpen]);
  if (loading) return <Notice>Loading games…</Notice>;
  if (error) return <Notice>{error}</Notice>;
  if (onlyGameId && !games?.length) {
    return <Notice>That game&apos;s lines are off the board now.</Notice>;
  }
  if (!games?.length) return <Notice>No upcoming games right now.</Notice>;

  return (
    <div className="space-y-3">
      {games.map((game) => (
        <div
          key={game.id}
          className="rounded-xl border border-gray-800 bg-gray-900 p-3"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
            <GameTime iso={game.commenceTime} />
            <button
              type="button"
              onClick={() => onOpen(game)}
              className="font-semibold text-emerald-400 hover:underline"
            >
              Props & alt lines ›
            </button>
          </div>
          {game.books[book] ? (
            <GameBoard
              game={game}
              book={book}
              toggle={toggle}
              isPicked={isPicked}
            />
          ) : (
            <p className="py-2 text-sm text-gray-500">
              {game.awayTeam} @ {game.homeTeam}: no {bookName} lines yet
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- One game: props and alt lines ----------

function AltLadder({
  sportKey,
  game,
  book,
  altKey,
  label,
  player,
  toggle,
  isPicked,
}: {
  sportKey: string;
  game: OddsGame;
  book: string;
  altKey: string;
  label: string;
  player: string;
  toggle: Toggle;
  isPicked: IsPicked;
}) {
  const { data, loading, error } = useEventMarkets(sportKey, game.id, [altKey]);
  if (loading)
    return <p className="py-3 text-sm text-gray-500">Loading alt lines…</p>;
  if (error) return <p className="py-3 text-sm text-red-400">{error}</p>;
  const lines = (data?.books[book]?.markets[altKey] ?? [])
    .filter((o) => o.player === player)
    .sort((a, b) => (a.point ?? 0) - (b.point ?? 0));
  if (!lines.length)
    return (
      <p className="py-3 text-sm text-gray-500">No alt {label} lines here.</p>
    );

  return (
    <div className="space-y-2 pb-1 pt-2">
      <p className="text-xs text-gray-500">
        Pick two or more lines on the same side to post a ladder.
      </p>
      {(['Over', 'Under'] as const).map((side) => {
        const sideLines = lines.filter((o) => o.name === side);
        if (!sideLines.length) return null;
        return (
          <div
            key={side}
            className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5"
          >
            {sideLines.map((o) => (
              <OddsButton
                key={`${o.name}${o.point}`}
                line={`${side === 'Over' ? 'O' : 'U'} ${o.point}`}
                outcome={o}
                picked={isPicked(game, altKey, o)}
                onClick={() => toggle(game, altKey, o)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One market (Receiving Yards, Alt Spreads…) as a section that opens on
 * click. Every one starts closed so a long props tab scans as a list; a
 * closed one still says how many picks it holds.
 */
function MarketSection({
  label,
  count,
  noun,
  picked,
  children,
}: {
  label: string;
  /** Players or lines inside */
  count: number;
  noun: string;
  picked: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-b border-gray-800 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-3 text-left"
      >
        <span className="font-bold">{label}</span>
        {picked > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-px text-[11px] font-bold text-emerald-400">
            {picked} picked
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {count} {noun}
        </span>
        <span
          aria-hidden="true"
          className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </section>
  );
}

type PlayerRow = {
  player: string;
  over?: OddsOutcome;
  under?: OddsOutcome;
  yes?: OddsOutcome;
};

function groupByPlayer(outcomes: OddsOutcome[]): PlayerRow[] {
  const rows = new Map<string, PlayerRow>();
  outcomes.forEach((o) => {
    if (!o.player) return;
    const row = rows.get(o.player) ?? { player: o.player };
    if (o.name === 'Over') row.over = o;
    else if (o.name === 'Under') row.under = o;
    else if (o.name === 'Yes') row.yes = o;
    rows.set(o.player, row);
  });
  return [...rows.values()];
}

function PropsPanel({
  sportKey,
  game,
  book,
  bookName,
  category,
  toggle,
  isPicked,
}: {
  sportKey: string;
  game: OddsGame;
  book: string;
  bookName: string;
  category: PickerCategory;
  toggle: Toggle;
  isPicked: IsPicked;
}) {
  const keys = useMemo(() => category.markets.map((m) => m.key), [category]);
  const { data, loading, error } = useEventMarkets(sportKey, game.id, keys);
  const [openAlt, setOpenAlt] = useState<string | null>(null);

  if (loading) return <Notice>Loading {category.label.toLowerCase()}…</Notice>;
  if (error) return <Notice>{error}</Notice>;
  const markets = data?.books[book]?.markets ?? {};
  if (!category.markets.some((m) => markets[m.key]?.length)) {
    return (
      <Notice>
        {bookName} has no {category.label.toLowerCase()} for this game yet.
      </Notice>
    );
  }

  if (category.game) {
    // Alternate spreads / totals
    return (
      <div>
        {category.markets.map((m) => {
          const outcomes = markets[m.key] ?? [];
          if (!outcomes.length) return null;
          const sides =
            m.key === 'alternate_spreads'
              ? [game.awayTeam, game.homeTeam]
              : ['Over', 'Under'];
          return (
            <MarketSection
              key={m.key}
              label={m.label}
              count={outcomes.length}
              noun="lines"
              picked={outcomes.filter((o) => isPicked(game, m.key, o)).length}
            >
              <div className="space-y-3">
                {sides.map((side) => {
                  const lines = outcomes
                    .filter((o) => o.name === side)
                    .sort((a, b) => (a.point ?? 0) - (b.point ?? 0));
                  if (!lines.length) return null;
                  return (
                    <div key={side}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {side}
                      </p>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1.5">
                        {lines.map((o) => (
                          <OddsButton
                            key={`${o.name}${o.point}`}
                            line={
                              m.key === 'alternate_spreads'
                                ? signed(o.point ?? 0)
                                : `${side === 'Over' ? 'O' : 'U'} ${o.point}`
                            }
                            outcome={o}
                            picked={isPicked(game, m.key, o)}
                            onClick={() => toggle(game, m.key, o)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </MarketSection>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {category.markets.map((m) => {
        const outcomes = markets[m.key] ?? [];
        const rows = groupByPlayer(outcomes);
        if (!rows.length) return null;
        return (
          <MarketSection
            key={m.key}
            label={m.label}
            count={rows.length}
            noun={rows.length === 1 ? 'player' : 'players'}
            picked={outcomes.filter((o) => isPicked(game, m.key, o)).length}
          >
            <ul className="-mt-2 divide-y divide-gray-800">
              {rows.map((r) => {
                const altId = `${m.alt}|${r.player}`;
                const point = r.over?.point ?? r.under?.point;
                return (
                  <li key={r.player} className="py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_repeat(2,4.75rem)] items-center gap-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {r.player}
                        </p>
                        {m.alt && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenAlt(openAlt === altId ? null : altId)
                            }
                            className="text-xs font-medium text-emerald-400 hover:underline"
                          >
                            {openAlt === altId
                              ? 'Hide alt lines'
                              : 'Alt lines / ladder ›'}
                          </button>
                        )}
                      </div>
                      {m.yesNo ? (
                        <>
                          <span />
                          <OddsButton
                            line="Yes"
                            outcome={r.yes}
                            picked={
                              r.yes ? isPicked(game, m.key, r.yes) : false
                            }
                            onClick={
                              r.yes
                                ? () => toggle(game, m.key, r.yes!)
                                : undefined
                            }
                          />
                        </>
                      ) : (
                        (['over', 'under'] as const).map((side) => {
                          const o = r[side];
                          return (
                            <OddsButton
                              key={side}
                              line={`${side === 'over' ? 'O' : 'U'} ${point ?? ''}`}
                              outcome={o}
                              picked={o ? isPicked(game, m.key, o) : false}
                              onClick={
                                o ? () => toggle(game, m.key, o) : undefined
                              }
                            />
                          );
                        })
                      )}
                    </div>
                    {m.alt && openAlt === altId && (
                      <AltLadder
                        sportKey={sportKey}
                        game={game}
                        book={book}
                        altKey={m.alt}
                        label={m.label}
                        player={r.player}
                        toggle={toggle}
                        isPicked={isPicked}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </MarketSection>
        );
      })}
    </div>
  );
}

function GameView({
  sportKey,
  game,
  book,
  bookName,
  toggle,
  isPicked,
  onBack,
}: {
  sportKey: string;
  game: OddsGame;
  book: string;
  bookName: string;
  toggle: Toggle;
  isPicked: IsPicked;
  /** Omitted when the game is the only one on offer */
  onBack?: () => void;
}) {
  const categories = PICKER_CATEGORIES[sportKey] ?? [];
  const [tab, setTab] = useState('lines');
  const category = categories.find((c) => c.key === tab);

  return (
    <div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-sm font-medium text-gray-400 hover:text-white"
        >
          ‹ All games
        </button>
      )}
      <p className="font-bold leading-tight">
        {game.awayTeam} @ {game.homeTeam}
      </p>
      <p className="mt-0.5 text-xs">
        <GameTime iso={game.commenceTime} />
      </p>

      <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        <Chip active={tab === 'lines'} onClick={() => setTab('lines')}>
          Game Lines
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c.key}
            active={tab === c.key}
            onClick={() => setTab(c.key)}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        {(tab === 'lines' || !category) &&
          (game.books[book] ? (
            <GameBoard
              game={game}
              book={book}
              toggle={toggle}
              isPicked={isPicked}
            />
          ) : (
            <Notice>No {bookName} lines for this game yet.</Notice>
          ))}
        {tab !== 'lines' && category && (
          <PropsPanel
            key={category.key}
            sportKey={sportKey}
            game={game}
            book={book}
            bookName={bookName}
            category={category}
            toggle={toggle}
            isPicked={isPicked}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Slip review ----------

function SlipSummary({
  mode,
  selections,
}: {
  mode: SlipMode;
  selections: Selection[];
}) {
  const decimal = slipDecimal(selections);
  if (mode === 'LADDER') {
    return (
      <>
        <span className="font-bold">{selections.length} Rung Ladder</span>
        <span className="text-gray-400">
          {' '}
          · {selectionTitle(selections[0]).replace(/ [\d.]+$/, '')}
        </span>
      </>
    );
  }
  const title =
    mode === 'STRAIGHT'
      ? selectionTitle(selections[0])
      : `${selections.length} Leg Parlay`;
  return (
    <>
      <span className="font-bold">{title}</span>{' '}
      {decimal && (
        <span className="text-gray-400">
          ·{' '}
          {formatAmerican(
            mode === 'STRAIGHT'
              ? selections[0].outcome.price
              : decimalToAmerican(decimal)
          )}
          {' · $10 pays '}
          {formatMoney(payout(10, decimal))}
        </span>
      )}
    </>
  );
}

// ---------- Picker ----------

export default function SlipPicker({
  header,
  onPosted,
  dirtyRef,
  group = null,
  edit = null,
  onSaved,
}: {
  header: React.ReactNode;
  onPosted: (kind: PostedKind) => void;
  dirtyRef: React.MutableRefObject<boolean>;
  /** Group parlay: pick exactly one leg, to start one or join one */
  group?: GroupMode | null;
  /** Editing a posted straight / parlay: starts on review with its legs */
  edit?: FeedPost | null;
  onSaved?: (post: FeedPost) => void;
}) {
  const meta = useMeta();
  const book = LIVE_ODDS_BOOK;
  /** One-game group parlay being joined: only its game is pickable */
  const onlyGame = group?.kind === 'join' ? group.game : null;
  const [sportKey, setSportKey] = useState(
    onlyGame?.sportKey || SPORT_ORDER[0]
  );
  const [openGame, setOpenGame] = useState<OddsGame | null>(null);
  // Editing starts from the slip as posted (legs keep their posted prices)
  const [initial] = useState(() => {
    if (!edit) return null;
    const bet = edit.bets[0];
    const multiplied = decimalToAmerican(
      parlayDecimal(bet.legs.map((l) => l.americanOdds))
    );
    return {
      selections: bet.legs.map(legToSelection),
      units: String(bet.units),
      // A parlay priced off its legs has no book price to show
      slipOdds:
        edit.type === 'PARLAY' && bet.americanOdds !== multiplied
          ? String(bet.americanOdds)
          : '',
      caption: edit.caption ?? '',
    };
  });
  const [selections, setSelections] = useState<Selection[]>(
    initial?.selections ?? []
  );
  const [step, setStep] = useState<'pick' | 'review'>(
    initial ? 'review' : 'pick'
  );
  const [units, setUnits] = useState(initial?.units ?? '1');
  const [rungUnits, setRungUnits] = useState<Record<string, string>>({});
  const [slipOdds, setSlipOdds] = useState(initial?.slipOdds ?? '');
  const [caption, setCaption] = useState(initial?.caption ?? '');
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ticks so picks on games that kick off mid-review get their LIVE chip
  const now = useNow();

  const dirty = initial
    ? selections.map((s) => s.key).join() !==
        initial.selections.map((s) => s.key).join() ||
      units !== initial.units ||
      slipOdds !== initial.slipOdds ||
      caption !== initial.caption
    : selections.length > 0 || caption.trim() !== '';
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    dirtyRef.current = dirty;
  }, [dirty, dirtyRef]);

  const bookName =
    meta?.sportsbooks.find((b) => b.key === book)?.name ?? 'FanDuel';
  const sports = SPORT_ORDER.filter((k) =>
    meta ? meta.sports.some((s) => s.key === k) : true
  );

  const isPicked: IsPicked = (game, marketKey, o) =>
    selections.some((s) => matchesPick(s, game, marketKey, o));

  const toggle: Toggle = (game, marketKey, o) => {
    // The list only shows the one game, but the server checks it too
    if (onlyGame && game.id !== onlyGame.eventId) return;
    const key = selectionKey(game.id, marketKey, o);
    setError(null);
    setSelections((prev) => {
      // Tapping a picked price (a posted leg too, when editing) removes it
      if (prev.some((s) => matchesPick(s, game, marketKey, o)))
        return prev.filter((s) => !matchesPick(s, game, marketKey, o));
      const picked: Selection = {
        key,
        sportKey: game.sportKey,
        eventId: game.id,
        eventLabel: eventLabelOf(game),
        marketKey,
        marketLabel: marketLabel(game.sportKey, marketKey),
        outcome: o,
        commenceTime: game.commenceTime,
      };
      // A group parlay leg is one pick; tapping another swaps it
      if (group) return [picked];
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, picked];
    });
  };

  const remove = (key: string) => {
    const next = selections.filter((s) => s.key !== key);
    setSelections(next);
    if (!next.length) setStep('pick');
  };

  let mode: SlipMode = 'PARLAY';
  if (selections.length === 1) mode = 'STRAIGHT';
  // An edited slip stays a straight or parlay
  else if (!edit && canLadder(selections)) mode = 'LADDER';
  const sameGame = mode === 'PARLAY' && isSameGame(selections);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sgp = slipOdds.trim() === '' ? undefined : Number(slipOdds);
    if (mode === 'PARLAY' && sgp !== undefined && !isValidAmerican(sgp)) {
      setError('The price must look like +450 or -120');
      return;
    }
    if (edit) {
      const changes = editPostSchema.safeParse({
        units: Number(units),
        keepLegIds: selections.flatMap((s) => (s.legId ? [s.legId] : [])),
        legs: selections.filter((s) => !s.legId).map(toLeg),
        slipOdds: mode === 'PARLAY' ? sgp : undefined,
        caption: caption.trim(),
      });
      if (!changes.success) {
        setError(changes.error.issues[0].message);
        return;
      }
      setSubmitting(true);
      try {
        const { data } = await api.put<FeedPost>(
          `/posts/${edit.id}`,
          changes.data
        );
        onSaved?.(data);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not save the slip'));
        setSubmitting(false);
      }
      return;
    }
    const input = buildPost({
      mode,
      selections,
      sportsbookKey: book,
      units: Number(units),
      rungUnits: Object.fromEntries(
        Object.entries(rungUnits).map(([k, v]) => [k, Number(v)])
      ),
      slipOdds: mode === 'PARLAY' ? sgp : undefined,
      caption: caption.trim(),
      seriesId,
    });
    const parsed = createPostSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/posts', parsed.data);
      onPosted('slip');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not post'));
      setSubmitting(false);
    }
  };

  if (group && step === 'review' && selections.length) {
    return (
      <GroupReview
        mode={group}
        selection={selections[0]}
        book={book}
        bookName={bookName}
        header={header}
        onBack={() => setStep('pick')}
        onPosted={onPosted}
      />
    );
  }

  if (step === 'review' && selections.length) {
    const sgpDecimal =
      mode === 'PARLAY' &&
      isValidAmerican(Number(slipOdds)) &&
      slipOdds.trim() !== ''
        ? americanToDecimal(Number(slipOdds))
        : null;
    const decimal = sgpDecimal ?? slipDecimal(selections);
    const straight = mode === 'STRAIGHT';
    return (
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <button
            type="button"
            onClick={() => setStep('pick')}
            className="text-sm font-medium text-gray-400 hover:text-white"
          >
            ‹ Add more picks
          </button>

          <div className="overflow-hidden rounded-xl border border-gray-800">
            {/* A straight's pick is its own headline, so it gets no title bar */}
            {!straight && (
              <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
                <div>
                  <p className="text-lg font-bold leading-tight">
                    {mode === 'PARLAY' &&
                      `${selections.length} Leg ${sameGame ? 'Same Game ' : ''}Parlay`}
                    {mode === 'LADDER' && `${selections.length} Rung Ladder`}
                  </p>
                  <p className="text-xs text-gray-500">{bookName}</p>
                </div>
                {mode === 'PARLAY' && decimal && (
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {formatAmerican(decimalToAmerican(decimal))}
                  </span>
                )}
              </div>
            )}
            <ul className="divide-y divide-gray-800">
              {(mode === 'LADDER'
                ? [...selections].sort(
                    (a, b) => (a.outcome.point ?? 0) - (b.outcome.point ?? 0)
                  )
                : selections
              ).map((s) => (
                <li key={s.key} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-bold leading-snug ${straight ? 'text-lg' : ''}`}
                    >
                      {selectionTitle(s)}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {s.marketLabel}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
                      {s.eventLabel}
                      {s.commenceTime && started(s.commenceTime, now) && (
                        <LiveBadge />
                      )}
                    </p>
                    {straight && (
                      <p className="mt-0.5 text-xs text-gray-500">{bookName}</p>
                    )}
                  </div>
                  {mode === 'LADDER' && (
                    <label className="w-16 shrink-0" htmlFor={`units-${s.key}`}>
                      <span className="sr-only">Units</span>
                      <input
                        id={`units-${s.key}`}
                        inputMode="decimal"
                        value={rungUnits[s.key] ?? '1'}
                        onChange={(e) =>
                          setRungUnits({
                            ...rungUnits,
                            [s.key]: e.target.value,
                          })
                        }
                        className={`${inputClass} px-2 py-1 text-right text-sm`}
                      />
                    </label>
                  )}
                  <span
                    className={`font-mono font-bold tabular-nums ${straight ? 'text-lg' : ''}`}
                  >
                    {formatAmerican(s.outcome.price)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${selectionTitle(s)}`}
                    onClick={() => remove(s.key)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {mode === 'LADDER' && (
              <p className="border-t border-gray-800 px-4 py-2 text-xs text-gray-500">
                Units per rung are in the boxes.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {mode !== 'LADDER' && (
              <label htmlFor="slip-units" className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">
                  Units
                </span>
                <input
                  id="slip-units"
                  inputMode="decimal"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}
            {mode === 'PARLAY' && (
              <label htmlFor="slip-sgp" className="block">
                <span className="mb-1 block text-xs font-medium text-gray-400">
                  {bookName} price (optional)
                </span>
                <input
                  id="slip-sgp"
                  inputMode="numeric"
                  placeholder="+450"
                  value={slipOdds}
                  onChange={(e) => setSlipOdds(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}
          </div>
          {mode === 'PARLAY' && (
            <p className="-mt-3 text-xs text-gray-500">
              {sameGame
                ? 'Books price same game parlays lower than the legs multiplied. '
                : 'Boosted or priced differently? '}
              Enter the price your {bookName} slip shows to post it exactly.
            </p>
          )}

          {/* Editing files it through the ⋯ menu's Move to series instead */}
          {!edit && <SeriesPicker value={seriesId} onChange={setSeriesId} />}

          <label htmlFor="slip-caption" className="block">
            <span className="mb-1 block text-xs font-medium text-gray-400">
              Caption
            </span>
            <textarea
              id="slip-caption"
              rows={3}
              maxLength={500}
              placeholder="Why you like it…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="border-t border-gray-800 bg-gray-950 px-5 py-4">
          {error && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-gray-300">
              {mode === 'LADDER' ? (
                `${selections.length} rungs at ${bookName}`
              ) : (
                <>
                  $10 pays{' '}
                  <span className="font-semibold">
                    {decimal ? formatMoney(payout(10, decimal)) : '—'}
                  </span>
                </>
              )}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {edit && (submitting ? 'Saving…' : 'Save changes')}
              {!edit && (submitting ? 'Posting…' : 'Post slip')}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="space-y-3 border-b border-gray-800 px-5 py-3">
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <span className="rounded border border-gray-700 px-1.5 py-px text-[11px] font-semibold text-gray-300">
            {bookName}
          </span>
          Live odds and lines from {bookName}
        </p>
        {onlyGame ? (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400">
            🎯 This group parlay is a {onlyGame.eventLabel} SGP
          </p>
        ) : (
          <div
            className="flex gap-1 rounded-xl bg-gray-900 p-1"
            aria-label="League"
          >
            {sports.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === sportKey}
                onClick={() => {
                  setSportKey(k);
                  setOpenGame(null);
                }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${
                  k === sportKey
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {SPORT_TABS[k] ?? k}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {openGame ? (
          <GameView
            sportKey={sportKey}
            game={openGame}
            book={book}
            bookName={bookName}
            toggle={toggle}
            isPicked={isPicked}
            onBack={onlyGame ? undefined : () => setOpenGame(null)}
          />
        ) : (
          <GamesList
            sportKey={sportKey}
            book={book}
            bookName={bookName}
            toggle={toggle}
            isPicked={isPicked}
            onOpen={setOpenGame}
            onlyGameId={onlyGame?.eventId}
          />
        )}
      </div>

      {/* The slip bar only appears once something's picked */}
      {selections.length > 0 && (
        <div className="flex items-center gap-3 border-t border-gray-800 bg-gray-950 px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-sm">
            <SlipSummary mode={mode} selections={selections} />
          </p>
          <button
            type="button"
            onClick={() => setStep('review')}
            className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400"
          >
            {group ? 'Use this leg' : `Review slip (${selections.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
