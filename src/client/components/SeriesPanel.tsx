import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../lib/api';
import { netColor, record, settledCount, signedUnits } from '../lib/statFormat';
import { SERIES_NAME_MAX, SERIES_DESCRIPTION_MAX } from '../../shared/series';
import type { SeriesSummary } from '../../shared/series';

// A person's series as a side-column panel: one row each (name, record,
// units), linking to the series page. The owner can start a new one here.

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500';

function NewSeriesForm({
  onCreated,
  onCancel,
}: {
  onCreated: (s: SeriesSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post<SeriesSummary>('/series', {
        name,
        description: description || undefined,
      });
      onCreated(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the series'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-2 py-2">
      <input
        aria-label="Series name"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        required
        maxLength={SERIES_NAME_MAX}
        placeholder="Name, e.g. CharLadder"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <input
        aria-label="Series description"
        maxLength={SERIES_DESCRIPTION_MAX}
        placeholder="What it is (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={inputClass}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-lg bg-emerald-500 px-3 py-1 text-sm font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SeriesPanel({
  username,
  isOwner,
  currentId,
  title = 'Series',
  reloadKey,
}: {
  username: string;
  isOwner: boolean;
  /** Highlight this one (on its own page) */
  currentId?: string;
  title?: string;
  reloadKey?: unknown;
}) {
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .get<SeriesSummary[]>(`/users/${encodeURIComponent(username)}/series`)
      .then(({ data }) => setSeries(data))
      .catch(() => setSeries([]));
  }, [username]);

  useEffect(load, [load, reloadKey]);

  // Nothing to show a visitor until there's a series
  if (!series || (!series.length && !isOwner)) return null;

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-2 pt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </h2>
        {isOwner && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            + New
          </button>
        )}
      </div>
      {creating && (
        <NewSeriesForm
          onCreated={(s) => {
            setSeries((prev) => [s, ...(prev ?? [])]);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {!series.length && !creating && (
        <p className="py-2 text-sm text-gray-500">
          Run a recurring bet under one name, like a ladder you post every week.
          It gets its own record.
        </p>
      )}
      <ul className="divide-y divide-gray-800">
        {series.map((s) => {
          const settled = settledCount(s.line) > 0;
          const current = s.id === currentId;
          return (
            <li key={s.id}>
              <Link
                to={`/u/${username}/s/${s.id}`}
                aria-current={current ? 'page' : undefined}
                className={`-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition hover:bg-gray-800 ${
                  current ? 'bg-emerald-500/10' : ''
                }`}
              >
                <span aria-hidden="true">📚</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-medium ${current ? 'text-emerald-400' : ''}`}
                  >
                    {s.name}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {s.slips} {s.slips === 1 ? 'slip' : 'slips'}
                  </span>
                </span>
                {settled ? (
                  <>
                    <span className="tabular-nums text-gray-400">
                      {record(s.line)}
                    </span>
                    <span
                      className={`w-16 text-right font-semibold tabular-nums ${netColor(s.line.net)}`}
                    >
                      {signedUnits(s.line.net)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">
                    {s.line.pending ? `${s.line.pending} pending` : '–'}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
