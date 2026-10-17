import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import { SERIES_NAME_MAX } from '../../shared/series';
import type { SeriesSummary } from '../../shared/series';
import { inputClass } from './ComposerParts';

// "Series" field on the slip review step: none, one of yours, or a new one
// started right there.

const NEW = '__new__';

export default function SeriesPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (seriesId: string | null) => void;
}) {
  const { profile } = useAuth();
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    api
      .get<SeriesSummary[]>(`/users/${profile.username}/series`)
      .then(({ data }) => setSeries(data))
      .catch(() => setSeries([]));
  }, [profile]);

  const create = async () => {
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post<SeriesSummary>('/series', { name });
      setSeries((prev) => [data, ...(prev ?? [])]);
      onChange(data.id);
      setCreating(false);
      setName('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the series'));
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div>
        <label htmlFor="new-series" className="block">
          <span className="mb-1 block text-xs font-medium text-gray-400">
            New series
          </span>
          <div className="flex gap-2">
            <input
              id="new-series"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              maxLength={SERIES_NAME_MAX}
              placeholder="CharLadder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // Inside the slip form; Enter makes the series, not the slip
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (name.trim()) create();
                }
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={create}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-lg border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </label>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <label htmlFor="slip-series" className="block">
      <span className="mb-1 block text-xs font-medium text-gray-400">
        Series (optional)
      </span>
      <select
        id="slip-series"
        value={value ?? ''}
        disabled={!series}
        onChange={(e) => {
          if (e.target.value === NEW) setCreating(true);
          else onChange(e.target.value || null);
        }}
        className={inputClass}
      >
        <option value="">No series</option>
        {series?.map((s) => (
          <option key={s.id} value={s.id}>
            📚 {s.name}
          </option>
        ))}
        <option value={NEW}>+ New series…</option>
      </select>
    </label>
  );
}
