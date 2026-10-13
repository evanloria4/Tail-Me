import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import useMeta, { Meta } from '../lib/useMeta';
import {
  americanToDecimal,
  formatAmerican,
  formatMoney,
  decimalToAmerican,
  isValidAmerican,
  parlayDecimal,
  payout,
} from '../../shared/odds';
import {
  createPostSchema,
  CreatePostInput,
  MARKETS,
  MarketKey,
} from '../../shared/posts';

type PostType = CreatePostInput['type'];

type LegDraft = {
  key: number;
  sportKey: string;
  eventLabel: string;
  marketKey: MarketKey;
  marketLabel: string;
  playerName: string;
  selection: string;
  line: string;
  americanOdds: string;
};

type RungDraft = {
  key: number;
  line: string;
  americanOdds: string;
  units: string;
};

const DEFAULT_SPORT = 'americanfootball_nfl';

const PROP_SUGGESTIONS = [
  'Passing Yards',
  'Passing TDs',
  'Rushing Yards',
  'Receiving Yards',
  'Receptions',
  'Anytime TD',
  'Points',
  'Goals',
  'Shots on Goal',
  'Saves',
];

let lastKey = 0;
const nextKey = () => {
  lastKey += 1;
  return lastKey;
};
const newLeg = (sportKey = DEFAULT_SPORT): LegDraft => ({
  key: nextKey(),
  sportKey,
  eventLabel: '',
  marketKey: 'h2h',
  marketLabel: '',
  playerName: '',
  selection: '',
  line: '',
  americanOdds: '',
});
const newRung = (): RungDraft => ({
  key: nextKey(),
  line: '',
  americanOdds: '',
  units: '1',
});

/** '' -> undefined so optional fields stay optional; junk -> NaN so validation catches it */
const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const odds = (s: string) => {
  const n = num(s);
  return n !== undefined && isValidAmerican(n) ? n : null;
};

function legInput(d: LegDraft) {
  return {
    sportKey: d.sportKey,
    eventLabel: d.eventLabel,
    marketKey: d.marketKey,
    marketLabel: d.marketLabel || undefined,
    playerName: d.playerName || undefined,
    selection: d.selection,
    line: num(d.line),
    americanOdds: num(d.americanOdds),
  };
}

// ---------- Inputs ----------

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-emerald-500';

function TextInput({
  label,
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-400">
        {label}
      </span>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <input id={id} className={inputClass} {...props} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-400">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- Leg editor ----------

function LegEditor({
  leg,
  sports,
  onChange,
  withPrice,
  allowMoneyline = true,
}: {
  leg: LegDraft;
  sports: Meta['sports'];
  onChange: (leg: LegDraft) => void;
  /** false for a ladder pick, where line + odds live on each rung */
  withPrice: boolean;
  allowMoneyline?: boolean;
}) {
  const set = (patch: Partial<LegDraft>) => onChange({ ...leg, ...patch });
  const propsListId = useId();

  const marketOptions = (Object.keys(MARKETS) as MarketKey[])
    .filter((k) => allowMoneyline || k !== 'h2h')
    .map((k) => ({ value: k, label: MARKETS[k] }));

  const changeMarket = (marketKey: MarketKey) =>
    set({
      marketKey,
      selection:
        marketKey === 'totals' || marketKey === 'player_prop' ? 'Over' : '',
      line: marketKey === 'h2h' ? '' : leg.line,
    });

  const sideOptions =
    leg.marketKey === 'player_prop'
      ? ['Over', 'Under', 'Yes']
      : ['Over', 'Under'];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Select
        label="League"
        value={leg.sportKey}
        onChange={(sportKey) => set({ sportKey })}
        options={sports.map((s) => ({ value: s.key, label: s.title }))}
      />
      <Select
        label="Market"
        value={leg.marketKey}
        onChange={(v) => changeMarket(v as MarketKey)}
        options={marketOptions}
      />
      <TextInput
        label="Game"
        placeholder="Chiefs @ Bills"
        value={leg.eventLabel}
        onChange={(e) => set({ eventLabel: e.target.value })}
        className="col-span-2"
      />

      {leg.marketKey === 'player_prop' && (
        <>
          <TextInput
            label="Player"
            placeholder="Patrick Mahomes"
            value={leg.playerName}
            onChange={(e) => set({ playerName: e.target.value })}
            className="col-span-2"
          />
          <TextInput
            label="Prop"
            placeholder="Passing TDs"
            list={propsListId}
            value={leg.marketLabel}
            onChange={(e) => set({ marketLabel: e.target.value })}
            className="col-span-2"
          />
          <datalist id={propsListId}>
            {PROP_SUGGESTIONS.map((p) => (
              <option key={p} value={p} aria-label={p} />
            ))}
          </datalist>
        </>
      )}

      {leg.marketKey === 'totals' || leg.marketKey === 'player_prop' ? (
        <Select
          label="Side"
          value={leg.selection}
          onChange={(selection) => set({ selection })}
          options={sideOptions.map((s) => ({ value: s, label: s }))}
        />
      ) : (
        <TextInput
          label="Team"
          placeholder="Kansas City Chiefs"
          value={leg.selection}
          onChange={(e) => set({ selection: e.target.value })}
          className={withPrice && leg.marketKey === 'h2h' ? 'col-span-1' : ''}
        />
      )}

      {withPrice && leg.marketKey !== 'h2h' && (
        <TextInput
          label={leg.marketKey === 'player_prop' ? 'Line (optional)' : 'Line'}
          placeholder={leg.marketKey === 'spreads' ? '-3.5' : '47.5'}
          inputMode="decimal"
          value={leg.line}
          onChange={(e) => set({ line: e.target.value })}
        />
      )}
      {withPrice && (
        <TextInput
          label="Odds"
          placeholder="-110"
          inputMode="numeric"
          value={leg.americanOdds}
          onChange={(e) => set({ americanOdds: e.target.value })}
        />
      )}
    </div>
  );
}

// ---------- Page ----------

function PaysRow({
  label,
  decimal,
}: {
  label: string;
  decimal: number | null;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-gray-300">{label}</span>
      <span className="font-mono">
        {decimal ? (
          <>
            <span className="text-gray-400">
              {formatAmerican(decimalToAmerican(decimal))}
            </span>
            {' · $10 pays '}
            <span className="font-semibold text-emerald-400">
              {formatMoney(payout(10, decimal))}
            </span>
          </>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </span>
    </div>
  );
}

const TABS: { type: PostType; label: string; hint: string }[] = [
  { type: 'STRAIGHT', label: 'Straight', hint: 'One pick' },
  { type: 'PARLAY', label: 'Parlay', hint: 'Multiple legs, one slip' },
  { type: 'LADDER', label: 'Ladder', hint: 'Same pick at climbing lines' },
];

export default function NewPost() {
  const { isSubscribed } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();

  const [type, setType] = useState<PostType>('STRAIGHT');
  const [sportsbookKey, setSportsbookKey] = useState('');
  const [caption, setCaption] = useState('');
  const [units, setUnits] = useState('1');
  const [straight, setStraight] = useState<LegDraft>(() => newLeg());
  const [parlay, setParlay] = useState<LegDraft[]>(() => [newLeg(), newLeg()]);
  const [slipOdds, setSlipOdds] = useState('');
  const [ladderPick, setLadderPick] = useState<LegDraft>(() => ({
    ...newLeg(),
    marketKey: 'player_prop',
    selection: 'Over',
  }));
  const [rungs, setRungs] = useState<RungDraft[]>(() => [
    newRung(),
    newRung(),
    newRung(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (meta && !sportsbookKey)
      setSportsbookKey(meta.sportsbooks[0]?.key ?? '');
  }, [meta, sportsbookKey]);

  if (!isSubscribed) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <h1 className="text-xl font-bold">Posting is for subscribers</h1>
        <p className="mt-2 text-gray-400">
          A $5/month subscription covers live odds and lets you post slips. Free
          accounts can still view and tail.
        </p>
      </div>
    );
  }

  if (!meta) return <p className="py-6 text-center text-gray-500">Loading…</p>;

  const buildInput = () => {
    const base = { sportsbookKey, caption: caption || undefined };
    if (type === 'STRAIGHT') {
      return { ...base, type, units: num(units), leg: legInput(straight) };
    }
    if (type === 'PARLAY') {
      return {
        ...base,
        type,
        units: num(units),
        legs: parlay.map(legInput),
        slipOdds: num(slipOdds),
      };
    }
    // Line + odds live on each rung, not the pick
    const pick = {
      ...legInput(ladderPick),
      line: undefined,
      americanOdds: undefined,
    };
    return {
      ...base,
      type,
      pick,
      rungs: rungs.map((r) => ({
        line: num(r.line),
        americanOdds: num(r.americanOdds),
        units: num(r.units),
      })),
    };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = createPostSchema.safeParse(buildInput());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.filter((p) => typeof p === 'number');
      setError(
        where.length && type !== 'STRAIGHT'
          ? `${type === 'PARLAY' ? 'Leg' : 'Rung'} ${Number(where[0]) + 1}: ${issue.message}`
          : issue.message
      );
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/posts', parsed.data);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not post'));
      setSubmitting(false);
    }
  };

  // Live preview
  const parlayOdds = parlay.map((l) => odds(l.americanOdds));
  const parlayComplete = parlayOdds.every((o) => o !== null);
  const multiplied = parlayComplete
    ? parlayDecimal(parlayOdds as number[])
    : null;
  const slip = odds(slipOdds);
  const straightOdds = odds(straight.americanOdds);

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-2xl font-bold">New slip</h1>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => setType(t.type)}
            className={`rounded-lg px-2 py-2 text-sm transition ${
              type === t.type
                ? 'bg-emerald-500 font-semibold text-gray-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
            <span className="hidden text-xs font-normal opacity-80 sm:block">
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Sportsbook"
          value={sportsbookKey}
          onChange={setSportsbookKey}
          options={meta.sportsbooks.map((b) => ({
            value: b.key,
            label: b.name,
          }))}
        />
        {type !== 'LADDER' && (
          <TextInput
            label="Units"
            inputMode="decimal"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        )}
      </div>

      {type === 'STRAIGHT' && (
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <LegEditor
            leg={straight}
            sports={meta.sports}
            onChange={setStraight}
            withPrice
          />
        </section>
      )}

      {type === 'PARLAY' && (
        <>
          {parlay.map((leg, i) => (
            <section
              key={leg.key}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">
                  Leg {i + 1}
                </h2>
                {parlay.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      setParlay(parlay.filter((l) => l.key !== leg.key))
                    }
                    className="text-sm text-gray-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <LegEditor
                leg={leg}
                sports={meta.sports}
                withPrice
                onChange={(updated) =>
                  setParlay(
                    parlay.map((l) => (l.key === leg.key ? updated : l))
                  )
                }
              />
            </section>
          ))}
          <button
            type="button"
            onClick={() =>
              setParlay([...parlay, newLeg(parlay[parlay.length - 1].sportKey)])
            }
            className="w-full rounded-lg border border-dashed border-gray-700 py-2 text-sm text-gray-400 hover:border-emerald-500 hover:text-emerald-400"
          >
            + Add leg
          </button>
          <TextInput
            label="Slip odds (optional — use your book's price for same-game parlays)"
            placeholder={
              multiplied
                ? formatAmerican(decimalToAmerican(multiplied))
                : '+600'
            }
            inputMode="numeric"
            value={slipOdds}
            onChange={(e) => setSlipOdds(e.target.value)}
          />
        </>
      )}

      {type === 'LADDER' && (
        <>
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-300">
              The pick
            </h2>
            <LegEditor
              leg={ladderPick}
              sports={meta.sports}
              onChange={setLadderPick}
              withPrice={false}
              allowMoneyline={false}
            />
          </section>
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-300">Rungs</h2>
            <div className="space-y-2">
              {rungs.map((rung, i) => {
                const setRung = (patch: Partial<RungDraft>) =>
                  setRungs(
                    rungs.map((r) =>
                      r.key === rung.key ? { ...r, ...patch } : r
                    )
                  );
                return (
                  <div key={rung.key} className="flex items-end gap-2">
                    <span className="w-6 pb-2.5 text-sm text-gray-500">
                      {i + 1}
                    </span>
                    <TextInput
                      label="Line"
                      placeholder="1.5"
                      inputMode="decimal"
                      value={rung.line}
                      onChange={(e) => setRung({ line: e.target.value })}
                      className="flex-1"
                    />
                    <TextInput
                      label="Odds"
                      placeholder="+150"
                      inputMode="numeric"
                      value={rung.americanOdds}
                      onChange={(e) =>
                        setRung({ americanOdds: e.target.value })
                      }
                      className="flex-1"
                    />
                    <TextInput
                      label="Units"
                      inputMode="decimal"
                      value={rung.units}
                      onChange={(e) => setRung({ units: e.target.value })}
                      className="w-20"
                    />
                    <button
                      type="button"
                      aria-label={`Remove rung ${i + 1}`}
                      disabled={rungs.length <= 2}
                      onClick={() =>
                        setRungs(rungs.filter((r) => r.key !== rung.key))
                      }
                      className="pb-2.5 text-gray-500 hover:text-red-400 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            {rungs.length < 10 && (
              <button
                type="button"
                onClick={() => setRungs([...rungs, newRung()])}
                className="mt-3 w-full rounded-lg border border-dashed border-gray-700 py-2 text-sm text-gray-400 hover:border-emerald-500 hover:text-emerald-400"
              >
                + Add rung
              </button>
            )}
          </section>
        </>
      )}

      <label htmlFor="caption" className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">
          Caption
        </span>
        <textarea
          id="caption"
          rows={3}
          maxLength={500}
          placeholder="Why you like it…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className={inputClass}
        />
      </label>

      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        {type === 'STRAIGHT' && (
          <PaysRow
            label="Straight"
            decimal={straightOdds ? americanToDecimal(straightOdds) : null}
          />
        )}
        {type === 'PARLAY' && (
          <>
            <PaysRow
              label={`${parlay.length}-leg parlay`}
              decimal={multiplied}
            />
            {slip && (
              <PaysRow label="At slip odds" decimal={americanToDecimal(slip)} />
            )}
          </>
        )}
        {type === 'LADDER' &&
          rungs.map((r, i) => {
            const o = odds(r.americanOdds);
            return (
              <PaysRow
                key={r.key}
                label={`Rung ${i + 1}${r.line ? ` · ${r.line}` : ''}`}
                decimal={o ? americanToDecimal(o) : null}
              />
            );
          })}
      </section>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-emerald-500 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? 'Posting…' : 'Post slip'}
      </button>
    </form>
  );
}
