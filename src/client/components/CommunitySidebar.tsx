import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../lib/api';
import { netColor, record, signedUnits } from '../lib/statFormat';
import { CommunityStats, DayTotal } from '../../shared/community';
import { siteDayKey } from '../../shared/time';

// Feed side column: who's hot, the week's leaderboard, and a month calendar
// of the group's green and red days.

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

function Initial({ name }: { name: string }) {
  return (
    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400">
      {name[0]}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-gray-500">{children}</p>;
}

/** "2026-10" -> next / previous month */
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
              className={`flex aspect-square items-center justify-center rounded text-[11px] tabular-nums ${dayClass(
                total
              )} ${key === today ? 'ring-2 ring-white/70' : ''} ${key > today ? 'opacity-40' : ''}`}
            >
              {i + 1}
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
          'No settled bets this month.'
        )}
      </p>
    </Panel>
  );
}

/** The group parlays' own record, plus whose legs carry and whose bust */
function GroupRecord({ group }: { group: CommunityStats['group'] }) {
  const settled = group.wins + group.losses + group.pushes;
  if (!settled && !group.open) return null;
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
      {group.legs.length > 0 && (
        <ul className="divide-y divide-gray-800">
          {group.legs.map((u) => (
            <li key={u.id}>
              <Link
                to={`/u/${u.username}`}
                className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition hover:bg-gray-800"
              >
                <Initial name={u.fullName} />
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
                {u.busted > 0 && (
                  <span
                    title={`Busted ${u.busted} group ${u.busted === 1 ? 'parlay' : 'parlays'}`}
                    className="w-9 text-right text-xs font-semibold text-red-400"
                  >
                    💀{u.busted}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function CommunitySidebar({
  reloadKey,
}: {
  /** Change it to refetch (new post, settled bet) */
  reloadKey?: unknown;
}) {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<CommunityStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [month, reloadKey]);

  if (error && !data) return <Empty>{error}</Empty>;
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
                  <Initial name={u.fullName} />
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
          <Empty>Nobody&apos;s hot right now. Yet.</Empty>
        )}
      </Panel>

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
                    {signedUnits(u.line.net)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Nobody&apos;s up this week.</Empty>
        )}
      </Panel>

      <GroupRecord group={data.group} />

      <Calendar month={data.month} days={data.days} onMonth={setMonth} />
    </div>
  );
}
