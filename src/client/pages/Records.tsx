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
// leaderboard or each person's group parlay legs. Tables at every width: on
// phones the name column stays pinned while the stats scroll sideways.

type Tab = 'leaders' | 'group';
type SortKey =
  | 'units'
  | 'winPct'
  | 'roi'
  | 'bets'
  | 'streak'
  | 'best'
  | 'misses';

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
    case 'misses':
      return r.nearMisses.count;
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
      className="flex min-w-0 items-center gap-2 hover:underline sm:gap-2.5"
    >
      <UserAvatar
        name={person.fullName}
        url={person.avatarUrl}
        color={person.avatarColor}
        className="h-7 w-7 flex-none text-xs sm:h-8 sm:w-8 sm:text-sm"
      />
      {/* Narrow on phones so the stats get the room; long names wrap */}
      <span className="min-w-0 max-w-[7.5rem] sm:max-w-none">
        <span className="block break-words font-semibold leading-tight">
          {person.fullName}
          {me && (
            <span className="ml-1.5 text-xs font-medium text-emerald-400">
              You
            </span>
          )}
        </span>
        <span className="hidden break-all text-xs text-gray-500 sm:block">
          @{person.username}
        </span>
      </span>
    </Link>
  );
}

/** The pinned name column; solid so scrolled cells pass under it */
const stickyCell =
  'sticky left-0 z-10 bg-gray-900 shadow-[1px_0_0_0] shadow-gray-800';
/** Your row's tint, layered on the pinned cell's solid background */
const meTint =
  'bg-[image:linear-gradient(rgb(var(--emerald-500)/0.06),rgb(var(--emerald-500)/0.06))]';

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
      className={`px-2 py-2 text-center font-semibold ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`relative uppercase tracking-wider transition hover:text-white ${active ? 'text-white' : ''}`}
      >
        {label}
        <span
          aria-hidden="true"
          className={`absolute left-full ml-0.5 ${active ? '' : 'invisible'}`}
        >
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
      className={`px-2 py-2 text-center font-semibold uppercase tracking-wider ${className}`}
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
            <th
              scope="col"
              className={`${stickyCell} py-2 pl-3 pr-2 font-semibold uppercase tracking-wider sm:pl-4`}
            >
              Person
            </th>
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
              sort={sort}
              onSort={onSort}
            />
            <SortHeader label="ROI" sortKey="roi" sort={sort} onSort={onSort} />
            <PlainHeader label="L5" className="!text-left" />
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
            <SortHeader
              label="1-leg misses"
              sortKey="misses"
              sort={sort}
              onSort={onSort}
            />
            <PlainHeader label="Faders" className="pr-4" />
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
                <td
                  className={`${stickyCell} ${r.id === meId ? meTint : ''} py-2.5 pl-3 pr-2 sm:pl-4`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 flex-none text-right text-xs tabular-nums text-gray-500">
                      {i + 1}
                    </span>
                    <Person person={r} me={r.id === meId} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-center">
                  {settled ? record(r.line) : '–'}
                </td>
                <td
                  className="px-2 py-2.5 text-center tabular-nums"
                  title={
                    showRates ? undefined : `Ranks after ${MIN_RANKED} bets`
                  }
                >
                  <span className={showRates ? '' : 'text-gray-500'}>
                    {pct(winPct(r.line))}
                  </span>
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2.5 font-semibold tabular-nums ${netColor(r.line.net)} text-center`}
                >
                  {settled ? signedUnits(r.line.net) : '–'}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-center">
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
                <td className="px-2 py-2.5 tabular-nums text-center">
                  <StreakText streak={r.streak} />
                </td>
                <td className="px-2 py-2.5 tabular-nums text-center">
                  {r.bestStreak ? `W${r.bestStreak}` : '–'}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-center tabular-nums">
                  {r.nearMisses.count ? (
                    <>
                      {r.nearMisses.count}
                      <span className="ml-1 text-xs text-gray-500">
                        ({signedUnits(r.nearMisses.units)})
                      </span>
                    </>
                  ) : (
                    '–'
                  )}
                </td>
                <td className="whitespace-nowrap py-2.5 pl-2 pr-4 tabular-nums text-center">
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

// ---------- Group parlays ----------

const hitPct = (r: GroupRow) =>
  r.hit + r.busted ? r.hit / (r.hit + r.busted) : null;

function GroupTable({ rows, meId }: { rows: GroupRow[]; meId?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-800 text-left text-[10px] text-gray-500">
          <tr>
            <th
              scope="col"
              className={`${stickyCell} py-2 pl-3 pr-2 font-semibold uppercase tracking-wider sm:pl-4`}
            >
              Person
            </th>
            <PlainHeader label="Parlays" />
            <PlainHeader label="Legs hit" />
            <PlainHeader label="Busted" />
            <PlainHeader label="Hit %" />
            <PlainHeader label="💀 Only miss" />
            <PlainHeader label="Cashed" />
            <PlainHeader label="L5 legs" className="pr-4 !text-left" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((r) => (
            <tr
              key={r.id}
              className={r.id === meId ? 'bg-emerald-500/5' : undefined}
            >
              <td
                className={`${stickyCell} ${r.id === meId ? meTint : ''} py-2.5 pl-3 pr-2 sm:pl-4`}
              >
                <Person person={r} me={r.id === meId} />
              </td>
              <td className="px-2 py-2.5 tabular-nums text-center">
                {r.parlays}
              </td>
              <td className="px-2 py-2.5 font-semibold tabular-nums text-emerald-400 text-center">
                {r.hit}
              </td>
              <td className="px-2 py-2.5 tabular-nums text-red-400 text-center">
                {r.busted}
              </td>
              <td className="px-2 py-2.5 tabular-nums text-center">
                {pct(hitPct(r))}
              </td>
              <td className="px-2 py-2.5 tabular-nums text-center">
                {r.onlyMiss}
              </td>
              <td className="px-2 py-2.5 tabular-nums text-center">
                {r.cashed}
              </td>
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

function GroupTab({
  group,
  meId,
}: {
  group: RecordsPage['group'];
  meId?: string;
}) {
  const { wins, losses, pushes, open, people, nearMisses } = group;
  // Who most often sank a parlay on their own
  const culprits = people
    .filter((p) => p.onlyMiss > 0)
    .sort((a, b) => b.onlyMiss - a.onlyMiss)
    .slice(0, 3);
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
      {nearMisses.count > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <span aria-hidden="true">💔 </span>Missed by one leg
          </p>
          <p className="mt-1 text-sm">
            <span className="text-2xl font-extrabold tabular-nums">
              {nearMisses.count}
            </span>{' '}
            {nearMisses.count === 1 ? 'parlay' : 'parlays'} · $10 on each would
            have paid{' '}
            <span className="font-semibold text-win">${nearMisses.paid}</span>
          </p>
          {culprits.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Most common culprits
              </p>
              <ol className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                {culprits.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <UserAvatar
                      name={c.fullName}
                      url={c.avatarUrl}
                      color={c.avatarColor}
                      className="h-6 w-6 flex-none text-[11px]"
                    />
                    <span className="font-medium">{c.fullName}</span>
                    <span className="font-semibold text-red-400">
                      💀{c.onlyMiss}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {people.length ? (
        <>
          <GroupTable rows={people} meId={meId} />
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
            <span className="text-xs text-gray-500 lg:hidden">
              Scroll the table sideways for every stat →
            </span>
          </div>

          {tab === 'leaders' ? (
            <div className="space-y-3">
              <LeaderTable
                rows={rows}
                sort={sort}
                onSort={setSort}
                meId={meId}
              />
              <p className="text-xs text-gray-500">
                Ladder rungs count as one bet each. Win % and ROI rank after{' '}
                {MIN_RANKED} settled bets. L5 and streaks are all-time. 1-leg
                misses: parlays that lost on one leg, with what they would have
                won. Faders: how everyone who faded them did.
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
