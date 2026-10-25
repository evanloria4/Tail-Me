import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import UserAvatar from '../components/UserAvatar';
import {
  userCounts,
  type AdminUser,
  type CreditsPage,
} from '../../shared/admin';
import {
  FREE_UNTIL,
  isPaid,
  isPromoActive,
  type SubscriptionStatus,
} from '../../shared/billing';
import { inSiteZone } from '../../shared/time';

// Admins only: how many people there are and who's paying. Everyone else is
// sent back to the feed (the API checks too).

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', day: 'numeric', year: 'numeric' })
  );

const STATUS: Record<SubscriptionStatus, { label: string; chip: string }> = {
  ACTIVE: { label: 'Active', chip: 'bg-emerald-500/15 text-emerald-400' },
  TRIALING: { label: 'Trial', chip: 'bg-sky-500/15 text-sky-400' },
  PAST_DUE: { label: 'Past due', chip: 'bg-amber-500/15 text-amber-400' },
  CANCELED: { label: 'Canceled', chip: 'bg-gray-800 text-gray-400' },
  NONE: { label: 'Free', chip: 'bg-gray-800 text-gray-400' },
};

/** When their plan next changes: renews, trial ends, or access ends */
function planDate(u: AdminUser): string | null {
  if (!isPaid(u.subscriptionStatus) || !u.currentPeriodEnd) return null;
  const date = shortDate(u.currentPeriodEnd);
  if (u.cancelAtPeriodEnd) return `Ends ${date}`;
  if (u.subscriptionStatus === 'TRIALING') return `Billing starts ${date}`;
  if (u.subscriptionStatus === 'PAST_DUE') return `Card failed, retrying`;
  return `Renews ${date}`;
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const status = STATUS[user.subscriptionStatus];
  const date = planDate(user);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link to={`/u/${user.username}`} tabIndex={-1} aria-hidden="true">
        <UserAvatar
          name={user.fullName}
          url={user.avatarUrl}
          color={user.avatarColor}
          className="h-9 w-9 text-sm"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/u/${user.username}`}
          className="block truncate font-medium hover:underline"
        >
          {user.fullName}
        </Link>
        <p className="truncate text-sm text-gray-500">
          @{user.username} · joined {shortDate(user.createdAt)}
        </p>
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {user.isAdmin && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
              Admin
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.chip}`}
          >
            {status.label}
          </span>
        </div>
        {date && <p className="text-xs text-gray-500">{date}</p>}
      </div>
    </li>
  );
}

const count = (n: number) => n.toLocaleString('en-US');

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', day: 'numeric' })
  );

/** One grid for the header and every row, so the numbers line up */
const creditGrid =
  'grid grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,4.5rem)]';

/**
 * Odds API credits: the shared key's month, the group's spend, and who
 * spent it. Only fresh calls count; a cache hit costs nobody anything.
 */
function CreditsSection({
  credits,
  error,
}: {
  credits: CreditsPage | null;
  error: string | null;
}) {
  const { balance, totals, users, since } = credits ?? {};
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Odds API credits</h2>
      <p className="mt-1 text-sm text-gray-400">
        Charged to whoever&apos;s picker or slip import made a fresh call;
        cached odds are free.
        {since && ` Tracked since ${dayLabel(since)}.`}
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Tile label="Today" value={totals?.today ?? 0} />
        <Tile label="7 days" value={totals?.week ?? 0} />
        <Tile label="30 days" value={totals?.month ?? 0} />
      </div>
      {balance && (
        <p className="mt-3 text-xs text-gray-500">
          Shared key this month: {count(balance.used)} used ·{' '}
          {count(balance.remaining)} left. That includes your other project on
          the same key.
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div
          className={`${creditGrid} border-b border-gray-800 px-4 py-2 text-right text-xs font-semibold text-gray-500`}
        >
          <span className="text-left">Person</span>
          <span>Today</span>
          <span>7d</span>
          <span>30d</span>
          <span>All</span>
        </div>
        {!credits && !error && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Loading…
          </p>
        )}
        {credits && users!.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No one has spent credits yet.
          </p>
        )}
        {users && users.length > 0 && (
          <ul className="divide-y divide-gray-800">
            {users.map(({ user, ...t }) => (
              <li
                key={user.id}
                className={`${creditGrid} px-4 py-2.5 text-right text-sm tabular-nums`}
              >
                <Link
                  to={`/u/${user.username}`}
                  className="flex min-w-0 items-center gap-2 text-left hover:underline"
                >
                  <UserAvatar
                    name={user.fullName}
                    url={user.avatarUrl}
                    color={user.avatarColor}
                    className="h-7 w-7 flex-none text-xs"
                  />
                  <span className="truncate font-medium">{user.fullName}</span>
                </Link>
                <span className={t.today ? '' : 'text-gray-600'}>
                  {count(t.today)}
                </span>
                <span>{count(t.week)}</span>
                <span className="font-semibold">{count(t.month)}</span>
                <span className="text-gray-400">{count(t.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<CreditsPage | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [tab, setTab] = useState<'subscribed' | 'all'>('subscribed');
  const isAdmin = !!profile?.isAdmin;

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get<AdminUser[]>('/admin/users')
      .then(({ data }) => setUsers(data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load users')));
    api
      .get<CreditsPage>('/admin/credits')
      .then(({ data }) => setCredits(data))
      .catch((err) =>
        setCreditsError(apiErrorMessage(err, 'Could not load credit usage'))
      );
  }, [isAdmin]);

  if (!profile) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const counts = users && userCounts(users);
  const subscribed = users?.filter((u) => isPaid(u.subscriptionStatus)) ?? [];
  const shown = tab === 'subscribed' ? subscribed : (users ?? []);
  const breakdown = counts
    ? [
        counts.trialing && `${counts.trialing} on trial`,
        counts.pastDue && `${counts.pastDue} past due`,
        counts.canceling && `${counts.canceling} canceling`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Users" value={counts?.total ?? 0} />
        <Tile
          label="Subscribed"
          value={counts?.subscribed ?? 0}
          note={breakdown || undefined}
        />
      </div>
      {isPromoActive() && (
        <p className="mt-3 text-xs text-gray-500">
          Everyone can post free through{' '}
          {shortDate(new Date(FREE_UNTIL.getTime() - 1).toISOString())}.
          Subscribed counts people with a Stripe plan; trials start billing when
          the promo ends.
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div
          role="tablist"
          aria-label="Users"
          className="flex gap-1 border-b border-gray-800 p-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'subscribed'}
            onClick={() => setTab('subscribed')}
            className={tabClass(tab === 'subscribed')}
          >
            Subscribed{counts ? ` (${counts.subscribed})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            onClick={() => setTab('all')}
            className={tabClass(tab === 'all')}
          >
            All users{counts ? ` (${counts.total})` : ''}
          </button>
        </div>
        {!users && !error && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Loading…
          </p>
        )}
        {users && shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            {tab === 'subscribed' ? 'No one has subscribed yet.' : 'No users.'}
          </p>
        )}
        {shown.length > 0 && (
          <ul className="divide-y divide-gray-800">
            {shown.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </section>

      <CreditsSection credits={credits} error={creditsError} />
    </div>
  );
}
