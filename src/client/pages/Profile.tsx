import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import useMeta from '../lib/useMeta';
import { useLayout } from '../components/AppLayout';
import PostList from '../components/PostList';
import {
  POST_TYPES,
  PostType,
  SettledResult,
  STAT_RANGES,
  StatLine,
  StatRange,
  UserProfile,
} from '../../shared/stats';

// ---------- Formatting ----------

const record = (l: StatLine) =>
  `${l.wins}-${l.losses}${l.pushes ? `-${l.pushes}` : ''}`;

const signedUnits = (n: number) =>
  `${n > 0 ? '+' : ''}${(Math.round(n * 100) / 100).toFixed(2)}u`;

const pct = (n: number | null, signed = false) => {
  if (n == null) return '–';
  const v = Math.round(n * 1000) / 10;
  return `${signed && v > 0 ? '+' : ''}${v}%`;
};

const winPct = (l: StatLine) =>
  l.wins + l.losses ? l.wins / (l.wins + l.losses) : null;

const netColor = (n: number) => {
  if (n > 0) return 'text-win';
  if (n < 0) return 'text-red-400';
  return '';
};

const settledCount = (l: StatLine) => l.wins + l.losses + l.pushes;

const EMPTY_LINE: StatLine = {
  wins: 0,
  losses: 0,
  pushes: 0,
  pending: 0,
  risked: 0,
  net: 0,
  roi: null,
};

const TYPE_LABELS: Record<PostType, string> = {
  STRAIGHT: 'Straights',
  PARLAY: 'Parlays',
  LADDER: 'Ladders',
};

const RANGE_TABS: Record<StatRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  all: 'All time',
};

const FORM_STYLES: Record<SettledResult, string> = {
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  PUSH: 'bg-yellow-500/15 text-yellow-300',
};

// ---------- Pieces ----------

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-tight">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

/** Dot beside a row: green up, red down, grey flat or unsettled */
const dotColor = (l: StatLine) => {
  if (!settledCount(l)) return 'bg-gray-700';
  if (l.net > 0) return 'bg-emerald-500';
  if (l.net < 0) return 'bg-red-400';
  return 'bg-gray-500';
};

/** One line per bet type / league: label, record, units */
function StatRow({ label, line }: { label: string; line: StatLine }) {
  const settled = settledCount(line) > 0;
  return (
    <li
      className="flex items-center gap-2.5 py-2 text-sm"
      title={
        settled
          ? `${pct(line.roi, true)} ROI · ${pct(winPct(line))} wins`
          : undefined
      }
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 flex-none rounded-full ${dotColor(line)}`}
      />
      <span
        className={`min-w-0 flex-1 truncate font-medium ${settled ? '' : 'text-gray-500'}`}
      >
        {label}
      </span>
      {settled ? (
        <>
          <span className="tabular-nums text-gray-400">{record(line)}</span>
          <span
            className={`w-16 text-right font-semibold tabular-nums ${netColor(line.net)}`}
          >
            {signedUnits(line.net)}
          </span>
        </>
      ) : (
        <span className="text-xs text-gray-500">
          {line.pending ? `${line.pending} pending` : '–'}
        </span>
      )}
    </li>
  );
}

function StatPanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-2 pt-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <ul className="divide-y divide-gray-800">{children}</ul>
      {note && <p className="pb-1 text-xs text-gray-500">{note}</p>}
    </section>
  );
}

function RangeTabs({
  value,
  onChange,
}: {
  value: StatRange;
  onChange: (r: StatRange) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5"
    >
      {(Object.keys(RANGE_TABS) as StatRange[]).map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            value === r
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {RANGE_TABS[r]}
        </button>
      ))}
    </div>
  );
}

/** Last 10 settled bets, newest on the left */
function Form({ results }: { results: SettledResult[] }) {
  if (!results.length) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Last {results.length}
      </span>
      <ol className="flex flex-wrap gap-1">
        {results.map((r, i) => (
          <li
            // Results have no id; position is the identity here
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            title={r}
            className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold ${FORM_STYLES[r]}`}
          >
            {r[0]}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EditProfile({
  fullName,
  bio,
  onDone,
}: {
  fullName: string;
  bio: string | null;
  onDone: (saved: boolean) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(fullName);
  const [text, setText] = useState(bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/me', { fullName: name, bio: text });
      await refreshProfile();
      onDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save'));
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-emerald-500';
  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <label htmlFor="profile-name" className="block text-sm">
        <span className="mb-1 block text-gray-400">Name</span>
        <input
          id="profile-name"
          className={input}
          value={name}
          maxLength={60}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label htmlFor="profile-bio" className="block text-sm">
        <span className="mb-1 block text-gray-400">Bio</span>
        <textarea
          id="profile-bio"
          className={`${input} resize-none`}
          rows={2}
          value={text}
          maxLength={160}
          placeholder="Hammer or fade?"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="rounded-lg border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- Page ----------

export default function Profile() {
  const { username = '' } = useParams();
  const { profile: me } = useAuth();
  const { feedVersion } = useLayout();
  const meta = useMeta();
  const [range, setRange] = useState<StatRange>('all');
  const [data, setData] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: body } = await api.get<UserProfile>(
        `/users/${encodeURIComponent(username)}`,
        { params: { range } }
      );
      setData(body);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this profile'));
    }
  }, [username, range]);

  useEffect(() => {
    load();
  }, [load, feedVersion]);

  // Fresh page per user, not the last person's numbers
  useEffect(() => {
    setData(null);
    setEditing(false);
    setRange('all');
  }, [username]);

  if (error && !data) {
    return (
      <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
        {error}
      </p>
    );
  }
  if (!data) return <p className="py-6 text-center text-gray-500">Loading…</p>;

  const { user, stats, tails, viewerTails } = data;
  const isMe = me?.id === user.id;
  const { overall, streak } = stats;
  const sportTitle = (key: string) =>
    meta?.sports.find((s) => s.key === key)?.title ?? key;
  const hasSettled = settledCount(overall) > 0;
  const joined = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  // Multi-league parlays sit out of the league cards; say so when it shows
  const leagueBets = stats.bySport.reduce(
    (n, s) => n + settledCount(s.line) + s.line.pending,
    0
  );
  const hasMultiLeague = leagueBets < settledCount(overall) + overall.pending;
  // Every active league in a fixed order (empty ones included), then any
  // since-retired league they bet
  const leagueLines = new Map(stats.bySport.map((s) => [s.sportKey, s.line]));
  const leagueKeys = [
    ...new Set([
      ...(meta?.sports.map((s) => s.key) ?? []),
      ...leagueLines.keys(),
    ]),
  ];

  let streakValue: React.ReactNode = '–';
  if (streak) {
    streakValue = (
      <span className={streak.kind === 'W' ? 'text-win' : 'text-red-400'}>
        {streak.kind === 'W' && streak.count >= 3 ? '🔥 ' : ''}
        {streak.kind}
        {streak.count}
      </span>
    );
  }

  // Desktop: two columns, breakdowns in a sticky side column next to the
  // slips. Smaller screens: one column, breakdowns between the tiles and slips.
  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_18rem] lg:grid-rows-[auto_1fr] lg:gap-x-6 lg:gap-y-5 lg:space-y-0">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-emerald-500/20 text-2xl font-bold uppercase text-emerald-400">
              {user.fullName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold leading-tight">
                {user.fullName}
              </h1>
              <p className="truncate text-sm text-gray-500">
                @{user.username} · Joined {joined}
              </p>
              {user.bio && !editing && (
                <p className="mt-2 whitespace-pre-wrap text-gray-200">
                  {user.bio}
                </p>
              )}
            </div>
            {isMe && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-none rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
              >
                Edit
              </button>
            )}
          </div>
          {editing && (
            <EditProfile
              fullName={user.fullName}
              bio={user.bio}
              onDone={(saved) => {
                setEditing(false);
                if (saved) load();
              }}
            />
          )}
        </section>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RangeTabs value={range} onChange={setRange} />
            {overall.pending > 0 && (
              <span className="text-sm text-gray-500">
                {overall.pending} pending
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Record"
              value={hasSettled ? record(overall) : '–'}
              sub={
                hasSettled ? `${pct(winPct(overall))} wins` : 'No settled bets'
              }
            />
            <Tile
              label="Units"
              value={
                <span className={netColor(overall.net)}>
                  {signedUnits(overall.net)}
                </span>
              }
              sub={`${pct(overall.roi, true)} ROI`}
            />
            <Tile
              label="Streak"
              value={streakValue}
              sub={
                stats.bestWinStreak ? `Best W${stats.bestWinStreak}` : undefined
              }
            />
            <Tile
              label="Tailed"
              value={tails.received}
              sub={`by ${tails.tailers} ${tails.tailers === 1 ? 'person' : 'people'}`}
            />
          </div>

          <Form results={stats.recent} />
        </div>
      </div>

      <aside className="grid content-start gap-3 sm:grid-cols-2 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:grid-cols-1 lg:self-start">
        <StatPanel title="By bet type">
          {POST_TYPES.map((t) => (
            <StatRow key={t} label={TYPE_LABELS[t]} line={stats.byType[t]} />
          ))}
        </StatPanel>

        {leagueKeys.length > 0 && (
          <StatPanel
            title="By league"
            note={
              hasMultiLeague
                ? 'Parlays that mix leagues only count overall.'
                : undefined
            }
          >
            {leagueKeys.map((key) => (
              <StatRow
                key={key}
                label={sportTitle(key)}
                line={leagueLines.get(key) ?? EMPTY_LINE}
              />
            ))}
          </StatPanel>
        )}

        {(settledCount(tails.line) > 0 || viewerTails) && (
          <StatPanel title="Tailing">
            <StatRow label="Tailed bets" line={tails.line} />
            {viewerTails && (
              <StatRow label="When you tail" line={viewerTails} />
            )}
          </StatPanel>
        )}
      </aside>

      <section className="lg:col-start-1 lg:row-start-2">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">
          Slips
          {range !== 'all' && (
            <span className="font-normal text-gray-500">
              {' '}
              · {STAT_RANGES[range]}
            </span>
          )}
        </h2>
        <PostList
          author={user.username}
          range={range}
          reloadKey={feedVersion}
          onChange={load}
          empty={
            <p className="rounded-2xl border border-dashed border-gray-800 p-8 text-center text-gray-400">
              {range === 'all'
                ? 'No slips yet.'
                : `No slips in the ${STAT_RANGES[range].toLowerCase()}.`}
            </p>
          }
        />
      </section>
    </div>
  );
}
