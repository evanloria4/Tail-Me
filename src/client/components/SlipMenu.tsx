import React, { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api from '../lib/api';
import type { BetResult, FeedPost } from '../../shared/posts';
import type { SeriesSummary } from '../../shared/series';
import { useDismiss } from './SlipSocial';
import { RESULT_OPTIONS, RESULT_STYLES } from './SlipParts';

// The author's "⋯" menu on their own slip: fix a result, move it to a series,
// or delete it. Keeping these here keeps the card itself uncluttered. Results
// grade themselves when games end, so "Change result" is only an override.

const itemClass =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-gray-800';

export default function SlipMenu({
  post,
  onSettle,
  onMove,
  onDelete,
}: {
  post: FeedPost;
  onSettle: (betId: string, result: BetResult) => void;
  onMove: (seriesId: string | null) => void;
  onDelete: () => void;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'series' | 'result'>('menu');
  const [series, setSeries] = useState<SeriesSummary[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const canFile = post.type !== 'GROUP_PARLAY';

  const close = () => {
    setOpen(false);
    setView('menu');
  };
  useDismiss(open, close, ref);

  const showSeries = () => {
    setView('series');
    if (!series && profile) {
      api
        .get<SeriesSummary[]>(`/users/${profile.username}/series`)
        .then(({ data }) => setSeries(data))
        .catch(() => setSeries([]));
    }
  };

  const move = (seriesId: string | null) => {
    close();
    if (seriesId !== (post.series?.id ?? null)) onMove(seriesId);
  };

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Slip options"
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-800 hover:text-white"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 py-1 shadow-xl"
        >
          {view === 'menu' && (
            <>
              {canFile && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView('result')}
                  className={itemClass}
                >
                  <span aria-hidden="true">✏️</span>
                  <span className="flex-1">Change result</span>
                  <span aria-hidden="true" className="text-gray-500">
                    ›
                  </span>
                </button>
              )}
              {canFile && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={showSeries}
                  className={itemClass}
                >
                  <span aria-hidden="true">📚</span>
                  <span className="flex-1">Move to series</span>
                  <span aria-hidden="true" className="text-gray-500">
                    ›
                  </span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onDelete();
                }}
                className={`${itemClass} text-red-400`}
              >
                <span aria-hidden="true">🗑</span>
                Delete slip
              </button>
            </>
          )}
          {view === 'result' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              <ul className="border-t border-gray-800">
                {post.bets.map((bet) => (
                  <li
                    key={bet.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {post.type === 'LADDER'
                        ? `${bet.legs[0].selection} ${bet.legs[0].line}`
                        : 'Result'}
                    </span>
                    <select
                      aria-label="Result"
                      value={bet.result}
                      onChange={(e) =>
                        onSettle(bet.id, e.target.value as BetResult)
                      }
                      className={`cursor-pointer rounded-md border-none px-2 py-0.5 text-[11px] font-bold tracking-wide outline-none ${RESULT_STYLES[bet.result]}`}
                    >
                      {RESULT_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
              <p className="border-t border-gray-800 px-3 py-2 text-xs text-gray-500">
                Results update on their own when games end. A result you set
                here won&apos;t be changed.
              </p>
            </>
          )}
          {view === 'series' && (
            <>
              <button
                type="button"
                onClick={() => setView('menu')}
                className="w-full px-3 pb-1.5 pt-1 text-left text-xs font-semibold text-gray-500 hover:text-white"
              >
                ‹ Back
              </button>
              {!series && (
                <p className="px-3 py-2 text-sm text-gray-500">Loading…</p>
              )}
              {series && (
                <ul className="max-h-64 overflow-y-auto border-t border-gray-800">
                  {[
                    { id: null as string | null, name: 'No series' },
                    ...series,
                  ].map((s) => {
                    const current = (post.series?.id ?? null) === s.id;
                    return (
                      <li key={s.id ?? 'none'}>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={current}
                          onClick={() => move(s.id)}
                          className={`${itemClass} ${current ? 'text-emerald-400' : ''}`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {s.id ? `📚 ${s.name}` : s.name}
                          </span>
                          {current && <span aria-hidden="true">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {series?.length === 0 && (
                <p className="border-t border-gray-800 px-3 py-2 text-xs text-gray-500">
                  Start a series from your profile or when you post a slip.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
