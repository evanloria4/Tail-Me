import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../lib/api';
import useAutoRefresh from '../lib/useAutoRefresh';
import { netColor, record, shortUnits, signedUnits } from '../lib/statFormat';
import { CommunityStats, DayTotal } from '../../shared/community';
import type { DaySuperlative } from '../../shared/community';
import { inSiteZone, shiftMonth, siteDayKey } from '../../shared/time';
import { GhostRows, PlaceholderNote } from './Placeholders';
import UserAvatar from './UserAvatar';

// Group stats around the feed: the week's leaderboard + group parlays on top of
// the feed (every screen); who's hot + a month calendar
// of the group's green and red days in the desktop side column. One fetch.

/** Top earners shown (the server sends at most this many too) */
const LEADERS = 3;

/** Gold, silver, bronze rank badges; solid fills read in both themes */
const RANK_STYLES = [
  'bg-yellow-300 text-gray-950 shadow-[0_0_0_3px] shadow-yellow-300/25',
  'bg-gray-300 text-gray-950 shadow-[0_0_0_3px] shadow-gray-300/25',
  'bg-orange-400 text-gray-950 shadow-[0_0_0_3px] shadow-orange-400/25',
];

/** A day this far up or down (in units) gets the strong shade */
const BIG_DAY_UNITS = 3;

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-3 pt-3">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Initial({
  name,
  url,
  color,
}: {
  name: string;
  url: string | null;
  color: string;
}) {
  return (
    <UserAvatar
      name={name}
      url={url}
      color={color}
      className="h-7 w-7 text-xs"
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-gray-500">{children}</p>;
}

function dayClass(total: DayTotal | undefined) {
  if (!total) return 'bg-gray-800/60 text-gray-500';
  const big = Math.abs(total.net) >= BIG_DAY_UNITS;
  if (total.net > 0) {
    return big
      ? 'bg-emerald-500 text-gray-950 font-bold'
      : 'bg-emerald-500/30 text-emerald-400 font-semibold';
  }
  if (total.net < 0) {
    return big
      ? 'bg-red-400 text-gray-950 font-bold'
      : 'bg-red-400/25 text-red-400 font-semibold';
  }
  return 'bg-gray-700 text-gray-300';
}

/** Units short enough for a day square: "+3.5", "-1", "+12" (whole from 10) */
function dayUnits(net: number) {
  const size = Math.abs(net);
  const n = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
  if (n === 0) return '0';
  return `${net > 0 ? '+' : '-'}${n}`;
}

function Calendar({
  month,
  days,
  onMonth,
}: {
  month: string;
  days: DayTotal[];
  onMonth: (m: string) => void;
}) {
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const byDay = new Map(days.map((d) => [d.day, d]));
  // Central, like every day on the site; the grid itself is plain calendar math
  const today = siteDayKey(new Date());
  const thisMonth = today.slice(0, 7);
  const title = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const net = days.reduce((s, d) => s + d.net, 0);
  const green = days.filter((d) => d.net > 0).length;
  const red = days.filter((d) => d.net < 0).length;

  const arrow =
    'flex h-6 w-6 items-center justify-center rounded text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <Panel
      title="Group days"
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonth(shiftMonth(month, -1))}
            className={arrow}
          >
            ‹
          </button>
          <span className="min-w-[6.5rem] text-center text-xs font-semibold text-gray-300">
            {title}
          </span>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => onMonth(shiftMonth(month, 1))}
            className={arrow}
          >
            ›
          </button>
        </div>
      }
    >
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-gray-500">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          // Weekday letters repeat; position is the identity
          // eslint-disable-next-line react/no-array-index-key
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <li key={`pad-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`;
          const total = byDay.get(key);
          const label = total
            ? `${signedUnits(total.net)} across ${total.bets} ${total.bets === 1 ? 'bet' : 'bets'}`
            : 'No settled bets';
          return (
            <li
              key={key}
              title={`${new Date(y, m - 1, i + 1).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}: ${label}`}
              // Date small at the top, the day's units centered beneath it
              className={`relative flex aspect-square items-center justify-center rounded tabular-nums ${dayClass(
                total
              )} ${key === today ? 'ring-2 ring-white/70' : ''} ${key > today ? 'opacity-40' : ''}`}
            >
              <span className="absolute inset-x-0 top-[3px] text-center text-[8px] font-medium leading-none opacity-75">
                {i + 1}
              </span>
              {/* Dead center on phones (big squares). The lg sidebar's squares
                  are ~33px, so there the units drop a hair to clear the date. */}
              {total && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold leading-none lg:pt-1.5 lg:text-[11px]">
                  {dayUnits(total.net)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-gray-400">
        {days.length ? (
          <>
            <span className="text-emerald-400">{green} green</span> ·{' '}
            <span className="text-red-400">{red} red</span> ·{' '}
            <span className={`font-semibold ${netColor(net)}`}>
              {signedUnits(net)}
            </span>
          </>
        ) : (
          'Green and red days fill in as bets settle.'
        )}
      </p>
    </Panel>
  );
}

/** The group parlays' own record, plus whose legs carry and whose bust */
/** Most people each view shows (the whole table lives on Records) */
const PICKERS_SHOWN = 3;

/**
 * Each view shows its half of the group (up to PICKERS_SHOWN), so with a
 * small group nobody's in both Top and Bottom
 */
const pickersShown = (count: number) =>
  Math.min(PICKERS_SHOWN, Math.ceil(count / 2));

type PickerRow = CommunityStats['group']['legs'][number];
const hitRate = (u: PickerRow) => u.hit / Math.max(1, u.hit + u.busted);

/**
 * Top: best hit rate first (more hits breaks ties). Bottom: worst hit rate
 * first (more busts breaks ties).
 */
function rankPickers(legs: PickerRow[], view: 'top' | 'bottom') {
  return [...legs].sort((a, b) =>
    view === 'top'
      ? hitRate(b) - hitRate(a) || b.hit - a.hit || a.busted - b.busted
      : hitRate(a) - hitRate(b) || b.busted - a.busted || a.hit - b.hit
  );
}

function GroupRecord({ group }: { group: CommunityStats['group'] }) {
  const [view, setView] = useState<'top' | 'bottom'>('top');
  const settled = group.wins + group.losses + group.pushes;
  if (!settled && !group.open) return null;
  const shown = rankPickers(group.legs, view).slice(
    0,
    pickersShown(group.legs.length)
  );
  return (
    <Panel
      title="Group parlays"
      action={
        group.open > 0 && (
          <span className="text-xs text-gray-500">{group.open} open</span>
        )
      }
    >
      <p className="py-1 text-2xl font-bold tabular-nums">
        {settled ? (
          <>
            <span className="text-win">{group.wins}</span>
            <span className="text-gray-500">-</span>
            <span className="text-red-400">{group.losses}</span>
            {group.pushes > 0 && (
              <span className="text-gray-500">-{group.pushes}</span>
            )}
          </>
        ) : (
          <span className="text-base font-medium text-gray-500">
            First one&apos;s still open
          </span>
        )}
      </p>
      {group.legs.length > 1 && (
        <div
          role="tablist"
          aria-label="Pickers"
          className="mb-1 mt-1 flex rounded-lg border border-gray-800 p-0.5 text-xs"
        >
          {(
            [
              ['top', 'Top pickers'],
              ['bottom', 'Bottom pickers'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
                view === key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {group.legs.length > 0 && (
        <ul className="divide-y divide-gray-800">
          {shown.map((u) => (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-gray-800"
              >
                <Initial
                  name={u.fullName}
                  url={u.avatarUrl}
                  color={u.avatarColor}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {u.fullName}
                </span>
                <span
                  title={`${u.hit} of ${u.hit + u.busted} legs hit`}
                  className="tabular-nums text-gray-400"
                >
                  <span className="font-semibold text-emerald-400">
                    {u.hit}
                  </span>
                  /{u.hit + u.busted}
                </span>
                {/* Only the parlays that lost on their leg alone */}
                {u.onlyMiss > 0 && (
                  <span
                    title={`Only miss on ${u.onlyMiss} group ${u.onlyMiss === 1 ? 'parlay' : 'parlays'}`}
                    className="w-9 text-right text-xs font-semibold text-red-400"
                  >
                    💀{u.onlyMiss}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/records?tab=group"
        className="mt-1 block rounded-lg py-1.5 text-center text-xs font-semibold text-emerald-400 transition hover:bg-gray-800"
      >
        See past parlays ›
      </Link>
    </Panel>
  );
}

/** Column count per card count, so a short day doesn't leave gaps */
const TODAY_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

const TODAY_TONES: Partial<Record<DaySuperlative['key'], string>> = {
  topEarner: 'text-win',
  roughDay: 'text-red-400',
};

/**
 * Top of the feed on every screen: the day's standouts (bets settled today,
 * Central). Hidden until someone qualifies for at least one.
 */
export function TodayStrip({ stats }: { stats: Stats }) {
  const cards = stats.data?.today ?? [];
  if (!cards.length) return null;
  const date = new Date().toLocaleDateString(
    'en-US',
    inSiteZone({ weekday: 'short', month: 'short', day: 'numeric' })
  );
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-3 pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Today
        </h2>
        <span className="text-xs text-gray-500">{date}</span>
      </div>
      <ul className={`grid gap-2 ${TODAY_COLUMNS[cards.length]}`}>
        {cards.map((c) => (
          <li key={c.key}>
            <Link
              to={`/u/${c.person.username}`}
              className="flex h-full flex-col rounded-xl bg-gray-800/50 px-3 py-2.5 transition hover:bg-gray-800"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <span aria-hidden="true">{c.icon} </span>
                {c.title}
              </span>
              <span
                className={`mt-1 text-lg font-extrabold leading-tight tabular-nums ${TODAY_TONES[c.key] ?? ''}`}
              >
                {c.value}
              </span>
              <span className="text-[11px] text-gray-500">{c.detail}</span>
              <span className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                <UserAvatar
                  name={c.person.fullName}
                  url={c.person.avatarUrl}
                  color={c.person.avatarColor}
                  className="h-5 w-5 flex-none text-[10px]"
                />
                <span className="min-w-0 break-words">
                  {c.person.fullName.trim().split(/\s+/)[0]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Group stats for the feed; pass a new reloadKey to refetch (new post, settled bet) */
export function useCommunityStats(reloadKey?: unknown) {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Results settle while people watch; refetch quietly, keeping what's shown
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1));

  useEffect(() => {
    api
      .get<CommunityStats>('/community', {
        params: { month: month ?? undefined },
      })
      .then(({ data: body }) => {
        setData(body);
        setError(null);
      })
      .catch((err) =>
        setError(apiErrorMessage(err, 'Could not load group stats'))
      );
  }, [month, reloadKey, tick]);

  return { data, error, setMonth };
}

type Stats = ReturnType<typeof useCommunityStats>;

/** Top of the feed on every screen: the week's leaderboard + group parlays */
function EarnersPanel({ data }: { data: CommunityStats }) {
  return (
    <Panel title="Top earners this week">
      {data.leaders.length ? (
        <ol className="divide-y divide-gray-800">
          {data.leaders.slice(0, LEADERS).map((u, i) => (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-gray-800"
              >
                <span
                  aria-label={`${i + 1}${['st', 'nd', 'rd'][i]} place`}
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${RANK_STYLES[i]}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {u.fullName}
                </span>
                <span className="tabular-nums text-gray-400">
                  {record(u.line)}
                </span>
                <span
                  className={`w-14 text-right font-semibold tabular-nums ${netColor(u.line.net)}`}
                >
                  {shortUnits(u.line.net)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <GhostRows />
          <PlaceholderNote>
            The week&apos;s top 3 show up here once bets settle.
          </PlaceholderNote>
        </>
      )}
    </Panel>
  );
}

function GroupPanel({ group }: { group: CommunityStats['group'] }) {
  const hasGroup = group.wins + group.losses + group.pushes + group.open > 0;
  if (hasGroup) return <GroupRecord group={group} />;
  return (
    <Panel title="Group parlays">
      <p className="py-1 text-2xl font-bold text-gray-600">0-0</p>
      <PlaceholderNote>
        Your group parlay record shows up here. Start one with the + button,
        then 👥 Group parlay.
      </PlaceholderNote>
    </Panel>
  );
}

export function CommunityHighlights({
  stats,
  stacked = false,
}: {
  stats: Stats;
  /** One column, for the desktop side column */
  stacked?: boolean;
}) {
  const { data, error } = stats;
  if (error && !data) return <Empty>{error}</Empty>;
  if (!data) return null;

  return (
    <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
      <EarnersPanel data={data} />
      <GroupPanel group={data.group} />
    </div>
  );
}

const TABS = [
  { key: 'earners', label: 'Top earners' },
  { key: 'group', label: 'Group Bets' },
  { key: 'calendar', label: 'Calendar' },
] as const;

/**
 * Below the desktop side column (phones, tablets): top earners, the group
 * parlay record and the calendar as tabs over one card, so the first slip
 * isn't pushed far down.
 */
export function CommunityTabs({ stats }: { stats: Stats }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('earners');
  const { data, error, setMonth } = stats;
  if (error && !data) return <Empty>{error}</Empty>;
  if (!data) return null;

  return (
    <div className="space-y-2">
      <div
        role="tablist"
        aria-label="Group stats"
        className="flex rounded-lg border border-gray-800 bg-gray-900 p-0.5"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'earners' && <EarnersPanel data={data} />}
      {tab === 'group' && <GroupPanel group={data.group} />}
      {tab === 'calendar' && (
        <Calendar month={data.month} days={data.days} onMonth={setMonth} />
      )}
    </div>
  );
}

/** Desktop side column: who's hot + the month calendar */
export default function CommunitySidebar({ stats }: { stats: Stats }) {
  const { data, setMonth } = stats;
  if (!data) return null;

  return (
    <div className="space-y-3">
      <Panel title="Who's hot">
        {data.hot.length ? (
          <ul className="divide-y divide-gray-800">
            {data.hot.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/u/${u.username}`}
                  className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-gray-800"
                >
                  <Initial
                    name={u.fullName}
                    url={u.avatarUrl}
                    color={u.avatarColor}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {u.fullName}
                  </span>
                  <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-xs font-bold text-orange-400">
                    🔥 {u.streak.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Anyone on a 3+ win streak shows up here.</Empty>
        )}
      </Panel>

      <Calendar month={data.month} days={data.days} onMonth={setMonth} />
    </div>
  );
}
