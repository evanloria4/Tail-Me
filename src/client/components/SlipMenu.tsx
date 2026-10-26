import React, { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api from '../lib/api';
import { isBoostable, nextRung } from '../../shared/posts';
import useNow from '../lib/useNow';
import {
  deleteState,
  editState,
  rungState,
  type ActionState,
} from '../lib/slipActions';
import {
  formatAmerican,
  isValidAmerican,
  MAX_BOOST_PCT,
} from '../../shared/odds';
import type { BetResult, FeedPost } from '../../shared/posts';
import type { SeriesSummary } from '../../shared/series';
import { useDismiss } from './SlipSocial';
import { RESULT_OPTIONS, RESULT_STYLES } from './SlipParts';

// The author's "⋯" menu on their own slip: edit it before its games start,
// set the book's real odds, fix a result, move it to a series, or delete it. Keeping these here keeps the card itself uncluttered. Results
// grade themselves when games end, so "Change result" is only an override.
// Admins get it on everyone's slips (minus Move to series, which is the
// poster's own), with edit open past kickoff and delete never blocked.

const itemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-800';

/**
 * A menu action with a hint under it ("12 min left"), or greyed out with
 * why it's locked ("Locked at kickoff")
 */
function ActionItem({
  icon,
  label,
  state,
  onClick,
  more = false,
  danger = false,
}: {
  icon: string;
  label: string;
  state: ActionState;
  onClick: () => void;
  /** Opens a sub-view (shows ›) */
  more?: boolean;
  danger?: boolean;
}) {
  const { allowed, note } = state;
  let tone = '';
  if (!allowed) tone = 'cursor-not-allowed text-gray-500 hover:bg-transparent';
  else if (danger) tone = 'text-red-400';
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={!allowed}
      aria-disabled={!allowed}
      className={`${itemClass} ${tone}`}
    >
      <span aria-hidden="true" className={allowed ? '' : 'opacity-50'}>
        {allowed ? icon : '🔒'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {note && (
          <span className="block text-xs font-normal text-gray-500">
            {note}
          </span>
        )}
      </span>
      {more && allowed && (
        <span aria-hidden="true" className="text-gray-500">
          ›
        </span>
      )}
    </button>
  );
}

/**
 * What a row edits: the book's price, the stake (0 allowed), or a profit
 * boost in percent (blank or 0 takes it off)
 */
/** Where a new boost starts */
const DEFAULT_BOOST_PCT = 25;

const FIELDS = {
  odds: {
    format: formatAmerican,
    parse: (v: string) => Number(v.replace(/^\+/, '')),
    valid: isValidAmerican,
    inputMode: 'numeric',
    saveLabel: 'Save odds',
  },
  units: {
    format: String,
    parse: Number,
    valid: (n: number) => Number.isFinite(n) && n >= 0 && n <= 100,
    inputMode: 'decimal',
    saveLabel: 'Save units',
  },
  boost: {
    // No boost yet starts at 25%, ready to save
    format: (n: number) => String(n || DEFAULT_BOOST_PCT),
    parse: (v: string) => (v === '' ? 0 : Number(v.replace(/%$/, ''))),
    valid: (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_BOOST_PCT,
    inputMode: 'numeric',
    saveLabel: 'Save boost',
  },
} as const;

/** One bet's odds or units: type the new number, Enter or ✓ saves it */
function NumberRow({
  field,
  id,
  label,
  current,
  onSave,
}: {
  field: keyof typeof FIELDS;
  id: string;
  label: string;
  current: number;
  onSave: (next: number) => Promise<boolean>;
}) {
  const f = FIELDS[field];
  const [value, setValue] = useState(f.format(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const next = f.parse(value.trim());
  // A blank boost means none; other fields need a number
  const valid = (value.trim() !== '' || field === 'boost') && f.valid(next);
  const changed = valid && next !== current;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError(true);
      return;
    }
    if (!changed) return;
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    setError(!ok);
  };

  // Units step by 1 (kept within 0-100); the ✓ still saves
  const stepper = field === 'units';
  const nudge = (dir: 1 | -1) => {
    const base = valid ? next : current;
    setValue(String(Math.min(100, Math.max(0, base + dir))));
    setError(false);
  };
  const stepClass =
    'h-7 w-7 flex-none rounded-md border border-gray-700 text-gray-300 transition hover:border-emerald-500 disabled:opacity-30';

  return (
    <li>
      <form onSubmit={save} className="flex items-center gap-2 px-3 py-2">
        <label
          htmlFor={`${field}-${id}`}
          className="min-w-0 flex-1 truncate text-sm"
        >
          {label}
        </label>
        {stepper && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            disabled={(valid ? next : current) <= 0}
            aria-label="1 unit less"
            className={stepClass}
          >
            −
          </button>
        )}
        <input
          id={`${field}-${id}`}
          inputMode={f.inputMode}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          className={`${stepper ? 'w-12' : 'w-20'} rounded-md border bg-gray-950 px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:border-emerald-500 ${
            error ? 'border-red-400' : 'border-gray-700'
          }`}
        />
        {field === 'boost' && (
          <span aria-hidden="true" className="-ml-1 text-sm text-gray-400">
            %
          </span>
        )}
        {stepper && (
          <button
            type="button"
            onClick={() => nudge(1)}
            disabled={(valid ? next : current) >= 100}
            aria-label="1 unit more"
            className={stepClass}
          >
            +
          </button>
        )}
        <button
          type="submit"
          disabled={!changed || saving}
          aria-label={f.saveLabel}
          className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-bold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-30"
        >
          ✓
        </button>
      </form>
    </li>
  );
}

export type RungInput = { line: number; americanOdds: number; units: number };

/**
 * A new rung for a ladder: the line starts one step past the longest price
 * (− / + nudge it by that step), then the book's odds and the units
 */
function AddRungForm({
  post,
  onSave,
}: {
  post: FeedPost;
  onSave: (rung: RungInput) => Promise<boolean>;
}) {
  const next = nextRung(
    post.bets.map((b) => ({
      line: b.legs[0].line,
      americanOdds: b.regularOdds ?? b.americanOdds,
      units: b.units,
    }))
  );
  const [line, setLine] = useState(String(next.line));
  const [odds, setOdds] = useState('');
  const [units, setUnits] = useState(String(next.units));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = post.bets[0].legs[0];
  const taken = new Set(post.bets.map((b) => b.legs[0].line));

  const nudge = (dir: 1 | -1) => {
    const n = Number(line);
    const base = Number.isFinite(n) ? n : next.line;
    setLine(String(Math.round((base + dir * next.step) * 100) / 100));
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const rung = {
      line: Number(line),
      americanOdds: FIELDS.odds.parse(odds.trim()),
      units: Number(units),
    };
    if (line.trim() === '' || !Number.isFinite(rung.line)) {
      setError('Enter a line');
      return;
    }
    if (taken.has(rung.line)) {
      setError('That line is already a rung');
      return;
    }
    if (odds.trim() === '' || !isValidAmerican(rung.americanOdds)) {
      setError('Odds must look like +150 or -120');
      return;
    }
    if (units.trim() === '' || !FIELDS.units.valid(rung.units)) {
      setError('Units must be 0 to 100');
      return;
    }
    setSaving(true);
    const ok = await onSave(rung);
    setSaving(false);
    if (!ok) setError('Could not add the rung');
  };

  const box =
    'rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-right font-mono text-sm tabular-nums outline-none focus:border-emerald-500';
  return (
    <form
      onSubmit={save}
      className="space-y-2 border-t border-gray-800 px-3 py-2"
    >
      <p className="truncate text-xs text-gray-400">
        {pick.playerName ? `${pick.playerName} ` : ''}
        {pick.selection}
      </p>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex-1 text-sm">
          Line
        </span>
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Line down ${next.step}`}
          className="h-7 w-7 rounded-md border border-gray-700 text-gray-300 hover:border-emerald-500"
        >
          −
        </button>
        <input
          aria-label="Line"
          inputMode="decimal"
          value={line}
          onChange={(e) => {
            setLine(e.target.value);
            setError(null);
          }}
          className={`w-16 ${box}`}
        />
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`Line up ${next.step}`}
          className="h-7 w-7 rounded-md border border-gray-700 text-gray-300 hover:border-emerald-500"
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex-1 text-sm">
          Odds
        </span>
        <input
          aria-label="Odds"
          inputMode="numeric"
          placeholder="+250"
          // The point of the form; the line is usually right already
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={odds}
          onChange={(e) => {
            setOdds(e.target.value);
            setError(null);
          }}
          className={`w-20 ${box}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex-1 text-sm">
          Units
        </span>
        <input
          aria-label="Units"
          inputMode="decimal"
          value={units}
          onChange={(e) => {
            setUnits(e.target.value);
            setError(null);
          }}
          className={`w-20 ${box}`}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-emerald-500 py-1.5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add rung'}
      </button>
    </form>
  );
}

export default function SlipMenu({
  post,
  onSettle,
  onMove,
  onDelete,
  onEdit,
  onOdds,
  onUnits,
  onBoost,
  onAddRung,
}: {
  post: FeedPost;
  onSettle: (betId: string, result: BetResult) => void;
  onMove: (seriesId: string | null) => void;
  onDelete: () => void;
  onEdit: () => void;
  onOdds: (betId: string, americanOdds: number) => Promise<boolean>;
  onUnits: (betId: string, units: number) => Promise<boolean>;
  onBoost: (betId: string, boostPct: number) => Promise<boolean>;
  onAddRung: (rung: RungInput) => Promise<boolean>;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<
    'menu' | 'series' | 'result' | 'odds' | 'boost' | 'units' | 'rung'
  >('menu');
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = !!profile?.isAdmin;
  const isAuthor = post.author.id === profile?.id;
  const personal = post.type !== 'GROUP_PARLAY';
  const boostable = isBoostable(post.type);
  const canFile = personal && isAuthor;
  // Hints count down while the menu is open
  const now = new Date(useNow());
  const edit = editState(post, now, isAdmin);
  const addRung = rungState(post, now, isAdmin);
  const del = deleteState(post, now, isAdmin);

  const close = () => {
    setOpen(false);
    setView('menu');
  };
  useDismiss(open, close, ref);

  const showSeries = () => {
    setView('series');
    if (!series && profile) {
      api
        .get<SeriesSummary[]>(`/users/${profile.username}/series`)
        .then(({ data }) => setSeries(data))
        .catch(() => setSeries([]));
    }
  };

  // One bet: a saved change is the whole edit, so the menu closes on its
  // own. Ladders have a row per rung and stay open (with Done) for more.
  const oneBet = post.bets.length === 1;
  const afterSave = (ok: boolean) => {
    if (ok && oneBet) close();
    return ok;
  };
  const doneButton = !oneBet && (
    <button
      type="button"
      onClick={close}
      className="w-full border-t border-gray-800 px-3 py-2 text-sm font-semibold text-emerald-400 hover:bg-gray-800"
    >
      Done
    </button>
  );

  const move = (seriesId: string | null) => {
    close();
    if (seriesId !== (post.series?.id ?? null)) onMove(seriesId);
  };

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Slip options"
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-800 hover:text-white"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 py-1 shadow-xl"
        >
          {view === 'menu' && (
            <>
              {!isAuthor && (
                <p className="px-3 pb-1.5 pt-1 text-xs font-semibold text-amber-400">
                  Admin · {post.author.fullName}’s slip
                </p>
              )}
              {/* Checked when the menu opens; the server checks again.
                  Locked actions stay listed, greyed, so the rules show */}
              {edit && (
                <ActionItem
                  icon="📝"
                  label="Edit slip"
                  state={edit}
                  onClick={() => {
                    close();
                    onEdit();
                  }}
                />
              )}
              {addRung && (
                <ActionItem
                  icon="🪜"
                  label="Add rung"
                  state={addRung}
                  more
                  onClick={() => setView('rung')}
                />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => setView('odds')}
                className={itemClass}
              >
                <span aria-hidden="true">🔢</span>
                <span className="flex-1">Change odds</span>
                <span aria-hidden="true" className="text-gray-500">
                  ›
                </span>
              </button>
              {/* Straights and parlays only; a boosted one takes it off in
                  one tap */}
              {boostable && post.bets[0].boostPct ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    if (await onBoost(post.bets[0].id, 0)) close();
                  }}
                  className={itemClass}
                >
                  <span aria-hidden="true">⚡</span>
                  <span className="flex-1">Remove boost</span>
                </button>
              ) : (
                // Ladders keep it listed, greyed, so the rule shows
                personal && (
                  <ActionItem
                    icon="⚡"
                    label="Boost"
                    state={
                      boostable
                        ? { allowed: true, note: null }
                        : { allowed: false, note: "Ladders can't be boosted" }
                    }
                    more
                    onClick={() => setView('boost')}
                  />
                )
              )}
              {personal && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('units')}
                  className={itemClass}
                >
                  <span aria-hidden="true">💵</span>
                  <span className="flex-1">Change units</span>
                  <span aria-hidden="true" className="text-gray-500">
                    ›
                  </span>
                </button>
              )}
              {personal && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('result')}
                  className={itemClass}
                >
                  <span aria-hidden="true">✏️</span>
                  <span className="flex-1">Change result</span>
                  <span aria-hidden="true" className="text-gray-500">
                    ›
                  </span>
                </button>
              )}
              {canFile && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={showSeries}
                  className={itemClass}
                >
                  <span aria-hidden="true">📚</span>
                  <span className="flex-1">Move to series</span>
                  <span aria-hidden="true" className="text-gray-500">
                    ›
                  </span>
                </button>
              )}
              <ActionItem
                icon="🗑"
                label="Delete slip"
                state={del}
                danger
                onClick={() => {
                  close();
                  onDelete();
                }}
              />
            </>
          )}
          {view === 'odds' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <ul className="border-t border-gray-800">
                {post.bets.map((bet) => (
                  <NumberRow
                    key={bet.id}
                    field="odds"
                    id={bet.id}
                    label={
                      post.type === 'LADDER'
                        ? `${bet.legs[0].selection} ${bet.legs[0].line}`
                        : 'Odds'
                    }
                    // The book's regular odds; a boost stays on top
                    current={bet.regularOdds ?? bet.americanOdds}
                    onSave={async (odds) =>
                      afterSave(await onOdds(bet.id, odds))
                    }
                  />
                ))}
              </ul>
              {doneButton}
            </>
          )}
          {view === 'boost' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <ul className="border-t border-gray-800">
                <NumberRow
                  field="boost"
                  id={post.bets[0].id}
                  label="Profit boost"
                  current={post.bets[0].boostPct ?? 0}
                  onSave={async (n) =>
                    afterSave(await onBoost(post.bets[0].id, n))
                  }
                />
              </ul>
            </>
          )}
          {view === 'rung' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <AddRungForm
                post={post}
                onSave={async (rung) => {
                  const ok = await onAddRung(rung);
                  if (ok) close();
                  return ok;
                }}
              />
            </>
          )}
          {view === 'units' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <ul className="border-t border-gray-800">
                {post.bets.map((bet) => (
                  <NumberRow
                    key={bet.id}
                    field="units"
                    id={bet.id}
                    label={
                      post.type === 'LADDER'
                        ? `${bet.legs[0].selection} ${bet.legs[0].line}`
                        : 'Units'
                    }
                    current={bet.units}
                    onSave={async (n) => afterSave(await onUnits(bet.id, n))}
                  />
                ))}
              </ul>
              {doneButton}
            </>
          )}
          {view === 'result' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <ul className="border-t border-gray-800">
                {post.bets.map((bet) => (
                  <li
                    key={bet.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {post.type === 'LADDER'
                        ? `${bet.legs[0].selection} ${bet.legs[0].line}`
                        : 'Result'}
                    </span>
                    <select
                      aria-label="Result"
                      value={bet.result}
                      onChange={(e) => {
                        onSettle(bet.id, e.target.value as BetResult);
                        if (oneBet) close();
                      }}
                      className={`cursor-pointer rounded-md border-none px-2 py-0.5 text-[11px] font-bold tracking-wide outline-none ${RESULT_STYLES[bet.result]}`}
                    >
                      {RESULT_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <p className="border-t border-gray-800 px-3 py-2 text-xs text-gray-500">
                Results update on their own when games end. A result you set
                here won&apos;t be changed.
              </p>
              {doneButton}
            </>
          )}
          {view === 'series' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              {!series && (
                <p className="px-3 py-2 text-sm text-gray-500">Loading…</p>
              )}
              {series && (
                <ul className="max-h-64 overflow-y-auto border-t border-gray-800">
                  {[
                    { id: null as string | null, name: 'No series', emoji: '' },
                    ...series,
                  ].map((s) => {
                    const current = (post.series?.id ?? null) === s.id;
                    return (
                      <li key={s.id ?? 'none'}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={current}
                          onClick={() => move(s.id)}
                          className={`${itemClass} ${current ? 'text-emerald-400' : ''}`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {s.emoji ? `${s.emoji} ${s.name}` : s.name}
                          </span>
                          {current && <span aria-hidden="true">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {series?.length === 0 && (
                <p className="border-t border-gray-800 px-3 py-2 text-xs text-gray-500">
                  Start a series from your profile or when you post a slip.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
