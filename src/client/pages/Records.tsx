import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import {
  netColor,
  pct,
  record,
  settledCount,
  signedUnits,
  winPct,
} from '../lib/statFormat';
import { useLayout } from '../components/AppLayout';
import { FormDots, RangeTabs } from '../components/RecordParts';
import UserAvatar from '../components/UserAvatar';
import { MIN_RANKED } from '../../shared/records';
import type {
  GroupRow,
  LeaderRow,
  MiniRecord,
  RecordsPage,
  Superlative,
} from '../../shared/records';
import type { StatRange, Streak } from '../../shared/stats';

// Everyone's records side by side: superlatives up top, then the personal
// leaderboard or each person's group parlay legs. Wide screens get sortable
// tables; phones get one card per person so nothing is cut off.

type Tab = 'leaders' | 'group';
type SortKey = 'units' | 'winPct' | 'roi' | 'bets' | 'streak' | 'best';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'units', label: 'Units' },
  { key: 'winPct', label: 'Win %' },
  { key: 'roi', label: 'ROI' },
  { key: 'bets', label: 'Most bets' },
  { key: 'streak', label: 'Streak' },
  { key: 'best', label: 'Best streak' },
];

/** Win % and ROI only rank people with enough settled bets */
const ranked = (r: LeaderRow) => settledCount(r.line) >= MIN_RANKED;

/** W3 sorts above W1 above L1 above L3 */
const streakValue = (s: Streak | null) => {
  if (!s) return 0;
  return s.kind === 'W' ? s.count : -s.count;
};

function sortValue(r: LeaderRow, key: SortKey): number {
  switch (key) {
    case 'winPct':
      return ranked(r) ? (winPct(r.line) ?? -1) : -2;
    case 'roi':
      return ranked(r) ? (r.line.roi ?? -1e9) : -2e9;
    case 'bets':
      return settledCount(r.line);
    case 'streak':
      return streakValue(r.streak);
    case 'best':
      return r.bestStreak;
    default:
      return r.line.net;
  }
}

const miniRecord = (m: MiniRecord) =>
  m.wins + m.losses + m.pushes
    ? `${m.wins}-${m.losses}${m.pushes ? `-${m.pushes}` : ''}`
    : '–';

function StreakText({ streak }: { streak: Streak | null }) {
  if (!streak) return <span className="text-gray-500">–</span>;
  return (
    <span
      className={`font-semibold ${streak.kind === 'W' ? 'text-emerald-400' : 'text-red-400'}`}
    >
      {streak.kind}
      {streak.count}
    </span>
  );
}

function Person({
  person,
  me,
}: {
  person: {
    username: string;
    fullName: string;
    avatarUrl: string | null;
    avatarColor: string;
  };
  me: boolean;
}) {
  return (
    <Link
      to={`/u/${person.username}`}
      className="flex min-w-0 items-center gap-2.5 hover:underline"
    >
      <UserAvatar
        name={person.fullName}
        url={person.avatarUrl}
        color={person.avatarColor}
        className="h-8 w-8 flex-none text-sm"
      />
      <span className="min-w-0">
        <span className="block break-words font-semibold leading-tight">
          {person.fullName}
          {me && (
            <span className="ml-1.5 text-xs font-medium text-emerald-400">
              You
            </span>
          )}
        </span>
        <span className="block break-all text-xs text-gray-500">
          @{person.username}
        </span>
      </span>
    </Link>
  );
}

// ---------- Superlatives ----------

const SUPERLATIVE_ICONS: Record<Superlative['key'], string> = {
  biggest: '💰',
  worstBeat: '💔',
  streak: '🔥',
  bestDay: '📅',
  mostTailed: '🎯',
  legs: '👑',
};

function Superlatives({ cards }: { cards: Superlative[] }) {
  if (!cards.length) return null;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <Link
          key={c.key}
          to={`/u/${c.person.username}`}
          className="flex flex-col rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 transition hover:border-gray-700"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <span aria-hidden="true">{SUPERLATIVE_ICONS[c.key]} </span>
            {c.title}
          </span>
          <span className="mt-1 text-2xl font-extrabold tabular-nums leading-tight">
            {c.value}
          </span>
          <span className="text-xs text-gray-400">{c.detail}</span>
          <span className="mt-2 flex items-center gap-2 text-sm font-medium">
            <UserAvatar
              name={c.person.fullName}
              url={c.person.avatarUrl}
              color={c.person.avatarColor}
              className="h-5 w-5 flex-none text-[10px]"
            />
            <span className="min-w-0 break-words">{c.person.fullName}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

// ---------- Leaderboard ----------

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? 'descending' : undefined}
      className={`px-2 py-2 font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wider transition hover:text-white ${active ? 'text-white' : ''}`}
      >
        {label}
        <span aria-hidden="true" className={active ? '' : 'invisible'}>
          ▾
        </span>
      </button>
    </th>
  );
}

function PlainHeader({
  label,
  className = '',
}: {
  label: string;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-2 py-2 font-semibold uppercase tracking-wider ${className}`}
    >
      {label}
    </th>
  );
}

function LeaderTable({
  rows,
  sort,
  onSort,
  meId,
}: {
  rows: LeaderRow[];
  sort: SortKey;
  onSort: (k: SortKey) => void;
  meId?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-800 text-left text-[10px] text-gray-500">
          <tr>
            <th scope="col" className="w-10 py-2 pl-4 pr-2 font-semibold">
              #
            </th>
            <PlainHeader label="Person" />
            <SortHeader
              label="Record"
              sortKey="bets"
              sort={sort}
              onSort={onSort}
            />
            <SortHeader
              label="Win %"
              sortKey="winPct"
              sort={sort}
              onSort={onSort}
            />
            <SortHeader
              label="Units"
              sortKey="units"
              className="text-right"
              sort={sort}
              onSort={onSort}
            />
            <SortHeader
              label="ROI"
              sortKey="roi"
              className="text-right"
              sort={sort}
              onSort={onSort}
            />
            <PlainHeader label="L5" />
            <SortHeader
              label="Streak"
              sortKey="streak"
              sort={sort}
              onSort={onSort}
            />
            <SortHeader
              label="Best"
              sortKey="best"
              sort={sort}
              onSort={onSort}
            />
            <PlainHeader label="Tailed" />
            <PlainHeader label="Faded" className="pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((r, i) => {
            const settled = settledCount(r.line) > 0;
            const showRates = ranked(r);
            return (
              <tr
                key={r.id}
                className={r.id === meId ? 'bg-emerald-500/5' : undefined}
              >
                <td className="py-2.5 pl-4 pr-2 tabular-nums text-gray-500">
                  {i + 1}
                </td>
                <td className="px-2 py-2.5">
                  <Person person={r} me={r.id === meId} />
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">
                  {settled ? record(r.line) : '–'}
                  {r.line.pending > 0 && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({r.line.pending} open)
                    </span>
                  )}
                </td>
                <td
                  className="px-2 py-2.5 tabular-nums"
                  title={
                    showRates ? undefined : `Ranks after ${MIN_RANKED} bets`
                  }
                >
                  <span className={showRates ? '' : 'text-gray-500'}>
                    {pct(winPct(r.line))}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums ${netColor(r.line.net)}`}
                >
                  {settled ? signedUnits(r.line.net) : '–'}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                  <span className={showRates ? '' : 'text-gray-500'}>
                    {pct(r.line.roi, true)}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  {r.l5.length ? (
                    <FormDots results={r.l5} size="sm" />
                  ) : (
                    <span className="text-gray-500">–</span>
                  )}
                </td>
                <td className="px-2 py-2.5 tabular-nums">
                  <StreakText streak={r.streak} />
                </td>
                <td className="px-2 py-2.5 tabular-nums">
                  {r.bestStreak ? `W${r.bestStreak}` : '–'}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">
                  {miniRecord(r.tailed)}
                </td>
                <td className="whitespace-nowrap py-2.5 pl-2 pr-4 tabular-nums">
                  {miniRecord(r.faded)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function LeaderCards({ rows, meId }: { rows: LeaderRow[]; meId?: string }) {
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const settled = settledCount(r.line) > 0;
        const showRates = ranked(r);
        return (
          <li
            key={r.id}
            className={`rounded-2xl border bg-gray-900 p-4 ${r.id === meId ? 'border-emerald-500/40' : 'border-gray-800'}`}
          >
            <div className="flex items-start gap-3">
              <span className="pt-1.5 text-sm font-bold tabular-nums text-gray-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Person person={r} me={r.id === meId} />
              </div>
              <span
                className={`text-lg font-extrabold tabular-nums ${netColor(r.line.net)}`}
              >
                {settled ? signedUnits(r.line.net) : '–'}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 text-sm">
              <Stat label="Record">
                {settled ? record(r.line) : '–'}
                {r.line.pending > 0 && (
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    +{r.line.pending}
                  </span>
                )}
              </Stat>
              <Stat label="Win %">
                <span className={showRates ? '' : 'text-gray-500'}>
                  {pct(winPct(r.line))}
                </span>
              </Stat>
              <Stat label="ROI">
                <span className={showRates ? '' : 'text-gray-500'}>
                  {pct(r.line.roi, true)}
                </span>
              </Stat>
              <Stat label="Streak">
                <StreakText streak={r.streak} />
              </Stat>
              <Stat label="Best">
                {r.bestStreak ? `W${r.bestStreak}` : '–'}
              </Stat>
              <Stat label="Tailed">{miniRecord(r.tailed)}</Stat>
              <Stat label="Faded">{miniRecord(r.faded)}</Stat>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  L5
                </dt>
                <dd className="mt-1">
                  {r.l5.length ? (
                    <FormDots results={r.l5} size="sm" />
                  ) : (
                    <span className="text-gray-500">–</span>
                  )}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Group parlays ----------

const hitPct = (r: GroupRow) =>
  r.hit + r.busted ? r.hit / (r.hit + r.busted) : null;

function GroupTable({ rows, meId }: { rows: GroupRow[]; meId?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-800 text-left text-[10px] text-gray-500">
          <tr>
            <PlainHeader label="Person" className="pl-4" />
            <PlainHeader label="Parlays" />
            <PlainHeader label="Legs hit" />
            <PlainHeader label="Busted" />
            <PlainHeader label="Hit %" />
            <PlainHeader label="💀 Only miss" />
            <PlainHeader label="Cashed" />
            <PlainHeader label="L5 legs" className="pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={r.id === meId ? 'bg-emerald-500/5' : undefined}
            >
              <td className="py-2.5 pl-4 pr-2">
                <Person person={r} me={r.id === meId} />
              </td>
              <td className="px-2 py-2.5 tabular-nums">{r.parlays}</td>
              <td className="px-2 py-2.5 font-semibold tabular-nums text-emerald-400">
                {r.hit}
              </td>
              <td className="px-2 py-2.5 tabular-nums text-red-400">
                {r.busted}
              </td>
              <td className="px-2 py-2.5 tabular-nums">{pct(hitPct(r))}</td>
              <td className="px-2 py-2.5 tabular-nums">{r.onlyMiss}</td>
              <td className="px-2 py-2.5 tabular-nums">{r.cashed}</td>
              <td className="py-2.5 pl-2 pr-4">
                {r.l5.length ? (
                  <FormDots results={r.l5} size="sm" />
                ) : (
                  <span className="text-gray-500">–</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupCards({ rows, meId }: { rows: GroupRow[]; meId?: string }) {
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`rounded-2xl border bg-gray-900 p-4 ${r.id === meId ? 'border-emerald-500/40' : 'border-gray-800'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <Person person={r} me={r.id === meId} />
            <span className="text-lg font-extrabold tabular-nums">
              {pct(hitPct(r))}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2.5 text-sm">
            <Stat label="Parlays">{r.parlays}</Stat>
            <Stat label="Legs hit">
              <span className="text-emerald-400">{r.hit}</span>
            </Stat>
            <Stat label="Busted">
              <span className="text-red-400">{r.busted}</span>
            </Stat>
            <Stat label="💀 Only miss">{r.onlyMiss}</Stat>
            <Stat label="Cashed">{r.cashed}</Stat>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                L5 legs
              </dt>
              <dd className="mt-1">
                {r.l5.length ? (
                  <FormDots results={r.l5} size="sm" />
                ) : (
                  <span className="text-gray-500">–</span>
                )}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

function GroupTab({
  group,
  meId,
}: {
  group: RecordsPage['group'];
  meId?: string;
}) {
  const { wins, losses, pushes, open, people } = group;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Group record
        </span>
        <span className="text-2xl font-extrabold tabular-nums">
          {wins}-{losses}
          {pushes ? `-${pushes}` : ''}
        </span>
        {open > 0 && <span className="text-sm text-gray-500">{open} open</span>}
      </div>
      {people.length ? (
        <>
          <div className="hidden lg:block">
            <GroupTable rows={people} meId={meId} />
          </div>
          <div className="lg:hidden">
            <GroupCards rows={people} meId={meId} />
          </div>
          <p className="text-xs text-gray-500">
            💀 Only miss: the parlay lost and theirs was the only leg that
            missed. Group parlays never count toward personal records.
          </p>
        </>
      ) : (
        <p className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-6 text-center text-sm text-gray-500">
          No group parlay legs in this range yet.
        </p>
      )}
    </div>
  );
}

// ---------- Page ----------

export default function Records() {
  const { profile } = useAuth();
  const { feedVersion } = useLayout();
  const [range, setRange] = useState<StatRange>('all');
  const [tab, setTab] = useState<Tab>('leaders');
  const [sort, setSort] = useState<SortKey>('units');
  const [data, setData] = useState<RecordsPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<RecordsPage>('/records', { params: { range } })
      .then(({ data: body }) => {
        if (!live) return;
        setData(body);
        setError(null);
      })
      .catch(
        (err) =>
          live && setError(apiErrorMessage(err, 'Could not load records'))
      );
    return () => {
      live = false;
    };
  }, [range, feedVersion]);

  const rows = useMemo(() => {
    if (!data) return [];
    // People with no bets in range sit at the bottom whatever the sort
    const active = (r: LeaderRow) => settledCount(r.line) + r.line.pending > 0;
    return [...data.leaderboard].sort(
      (a, b) =>
        Number(active(b)) - Number(active(a)) ||
        sortValue(b, sort) - sortValue(a, sort) ||
        a.fullName.localeCompare(b.fullName)
    );
  }, [data, sort]);

  const meId = profile?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Records</h1>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {error && !data && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="py-6 text-center text-gray-500">Loading…</p>
      )}

      {data && (
        <>
          <Superlatives cards={data.superlatives} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Records"
              className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5"
            >
              {(
                [
                  ['leaders', 'Leaderboard'],
                  ['group', 'Group parlays'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    tab === key
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Phones sort here; wide screens click the column headers */}
            {tab === 'leaders' && (
              <label
                htmlFor="records-sort"
                className="flex items-center gap-2 text-sm text-gray-400 lg:hidden"
              >
                Sort by
                <select
                  id="records-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-sm text-white"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {tab === 'leaders' ? (
            <div className="space-y-3">
              <div className="hidden lg:block">
                <LeaderTable
                  rows={rows}
                  sort={sort}
                  onSort={setSort}
                  meId={meId}
                />
              </div>
              <div className="lg:hidden">
                <LeaderCards rows={rows} meId={meId} />
              </div>
              <p className="text-xs text-gray-500">
                Ladder rungs count as one bet each. Win % and ROI rank after{' '}
                {MIN_RANKED} settled bets. L5 and streaks are all-time. Tailed:
                how their tailed slips did. Faded: how people who faded them
                did.
              </p>
            </div>
          ) : (
            <GroupTab group={data.group} meId={meId} />
          )}
        </>
      )}
    </div>
  );
}
