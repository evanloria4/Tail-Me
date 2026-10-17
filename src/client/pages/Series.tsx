import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import { PAGE_GRID, SIDE_COLUMN } from '../lib/layout';
import {
  netColor,
  pct,
  record,
  settledCount,
  signedUnits,
  winPct,
} from '../lib/statFormat';
import useStickyTop from '../lib/useStickyTop';
import { useLayout } from '../components/AppLayout';
import useConfirm from '../components/ConfirmDialog';
import PostList from '../components/PostList';
import SeriesPanel from '../components/SeriesPanel';
import StatTile from '../components/StatTile';
import { SERIES_DESCRIPTION_MAX, SERIES_NAME_MAX } from '../../shared/series';
import type { SeriesPage } from '../../shared/series';
import { inSiteZone } from '../../shared/time';

// One series: its record and its slips. The page a future Subscribe button
// will live on.

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-emerald-500';

function EditSeries({
  series,
  onSaved,
  onCancel,
}: {
  series: SeriesPage;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(series.name);
  const [description, setDescription] = useState(series.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/series/${series.id}`, { name, description });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      <label htmlFor="series-name" className="block text-sm">
        <span className="mb-1 block text-gray-400">Name</span>
        <input
          id="series-name"
          required
          maxLength={SERIES_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label htmlFor="series-description" className="block text-sm">
        <span className="mb-1 block text-gray-400">Description</span>
        <textarea
          id="series-description"
          rows={2}
          maxLength={SERIES_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} resize-none`}
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
          onClick={onCancel}
          className="rounded-lg border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Series() {
  const { username = '', seriesId = '' } = useParams();
  const { profile } = useAuth();
  const { feedVersion } = useLayout();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const side = useStickyTop<HTMLElement>();
  const [series, setSeries] = useState<SeriesPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SeriesPage>(`/series/${seriesId}`);
      setSeries(data);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this series'));
    }
  }, [seriesId]);

  useEffect(() => {
    setSeries(null);
    setEditing(false);
    load();
  }, [load, feedVersion]);

  if (error && !series) {
    return (
      <p className="mx-auto max-w-2xl rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
        {error}
      </p>
    );
  }
  if (!series)
    return <p className="py-6 text-center text-gray-500">Loading…</p>;

  const isOwner = series.owner.id === profile?.id;
  const { line, streak } = series;
  const hasSettled = settledCount(line) > 0;
  const started = new Date(series.createdAt).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', year: 'numeric' })
  );

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${series.name}?`,
      message:
        'The series goes away. Its slips stay on your profile, just not filed under it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/series/${series.id}`);
      navigate(`/u/${series.owner.username}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the series'));
    }
  };

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

  return (
    <div
      className={`${PAGE_GRID} space-y-5 lg:grid-rows-[auto_1fr] lg:gap-y-5 lg:space-y-0`}
    >
      {confirmDialog}
      <div className="space-y-5 lg:col-start-1 lg:row-start-1 xl:col-start-2">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl"
            >
              📚
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-extrabold leading-tight">
                {series.name}
              </h1>
              <p className="truncate text-sm text-gray-500">
                by{' '}
                <Link
                  to={`/u/${series.owner.username}`}
                  className="font-semibold text-gray-300 hover:underline"
                >
                  {series.owner.fullName}
                </Link>{' '}
                · Started {started}
              </p>
              {series.description && !editing && (
                <p className="mt-2 whitespace-pre-wrap text-gray-200">
                  {series.description}
                </p>
              )}
            </div>
            {isOwner && !editing && (
              <div className="flex flex-none gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          {editing && (
            <EditSeries
              series={series}
              onSaved={() => {
                setEditing(false);
                load();
              }}
              onCancel={() => setEditing(false)}
            />
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Record"
            value={hasSettled ? record(line) : '–'}
            sub={hasSettled ? `${pct(winPct(line))} wins` : 'No settled bets'}
          />
          <StatTile
            label="Units"
            value={
              <span className={netColor(line.net)}>
                {signedUnits(line.net)}
              </span>
            }
            sub={`${pct(line.roi, true)} ROI`}
          />
          <StatTile label="Streak" value={streakValue} />
          <StatTile
            label="Slips"
            value={series.slips}
            sub={line.pending ? `${line.pending} pending` : undefined}
          />
        </div>
      </div>

      <aside
        ref={side.ref}
        style={{ top: side.top }}
        className={`${SIDE_COLUMN} lg:row-span-2 lg:row-start-1`}
      >
        <SeriesPanel
          username={series.owner.username}
          isOwner={isOwner}
          currentId={series.id}
          title={
            isOwner
              ? 'Your series'
              : `${series.owner.fullName.split(' ')[0]}'s series`
          }
          reloadKey={`${feedVersion}-${series.name}`}
        />
      </aside>

      <section className="lg:col-start-1 lg:row-start-2 xl:col-start-2">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Slips</h2>
        <PostList
          author={username}
          series={series.id}
          reloadKey={feedVersion}
          onChange={load}
          empty={
            <p className="rounded-2xl border border-dashed border-gray-800 p-8 text-center text-gray-400">
              {isOwner
                ? 'Nothing in this series yet. Pick it under "Series" when you post a slip.'
                : 'Nothing in this series yet.'}
            </p>
          }
        />
      </section>
    </div>
  );
}
