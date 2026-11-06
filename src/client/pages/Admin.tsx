import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import UserAvatar from '../components/UserAvatar';
import type { AdminUser, CreditsPage } from '../../shared/admin';
import { inSiteZone } from '../../shared/time';

// Admins only: everyone's account and Odds API credit use. Everyone else is
// sent back to the feed (the API checks too).

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', day: 'numeric', year: 'numeric' })
  );

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
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
      {user.isAdmin && (
        <span className="flex-none rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400">
          Admin
        </span>
      )}
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

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <h2 className="border-b border-gray-800 px-4 py-3 font-semibold">
          Users{users ? ` (${users.length})` : ''}
        </h2>
        {!users && !error && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Loading…
          </p>
        )}
        {users && users.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No users.
          </p>
        )}
        {users && users.length > 0 && (
          <ul className="divide-y divide-gray-800">
            {users.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </ul>
        )}
      </section>

      <CreditsSection credits={credits} error={creditsError} />
    </div>
  );
}
