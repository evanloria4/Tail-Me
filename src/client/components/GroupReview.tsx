import React, { useState } from 'react';
import api, { apiErrorMessage } from '../lib/api';
import { Selection, selectionTitle, toLeg } from '../lib/slip';
import { formatAmerican } from '../../shared/odds';
import {
  createPostSchema,
  GROUP_MAX_LOCK_DAYS,
  joinGroupSchema,
} from '../../shared/posts';
import { inputClass } from './ComposerParts';
import { fromSiteInput, toSiteInput } from '../../shared/time';

// Last step of the picker for group parlays: start one with your leg and a
// deadline, or add your leg to a friend's.

/** A group parlay's one game, when it's kept to one */
export type GroupGame = {
  eventId: string;
  eventLabel: string;
  sportKey: string;
};

/** The group parlay a leg is being added to */
export type JoinTarget = { postId: string; game: GroupGame | null };

export type GroupMode = { kind: 'start' } | ({ kind: 'join' } & JoinTarget);

export type PostedKind = 'slip' | 'group' | 'leg';

/** Lock at your game's start when it's far enough off, else in three hours */
function defaultDeadline(sel: Selection): Date {
  const start = sel.commenceTime ? new Date(sel.commenceTime) : null;
  if (start && start.getTime() > Date.now() + 15 * 60_000) return start;
  return new Date(Date.now() + 3 * 3600_000);
}

export default function GroupReview({
  mode,
  selection,
  book,
  bookName,
  header,
  onBack,
  onPosted,
}: {
  mode: GroupMode;
  selection: Selection;
  book: string;
  bookName: string;
  header: React.ReactNode;
  onBack: () => void;
  onPosted: (kind: PostedKind) => void;
}) {
  const [lockAt, setLockAt] = useState(() =>
    toSiteInput(defaultDeadline(selection))
  );
  const [caption, setCaption] = useState('');
  const [gameOnly, setGameOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const starting = mode.kind === 'start';
  const now = new Date();
  const latest = new Date(now.getTime() + GROUP_MAX_LOCK_DAYS * 86400_000);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const leg = toLeg(selection);
    try {
      if (mode.kind === 'start') {
        // The input is Central wall-clock time, like everything on the site
        const deadline = fromSiteInput(lockAt);
        if (!deadline || deadline <= new Date()) {
          setError('Pick a deadline in the future');
          return;
        }
        const parsed = createPostSchema.safeParse({
          type: 'GROUP_PARLAY',
          sportsbookKey: book,
          lockAt: deadline.toISOString(),
          caption: caption.trim() || undefined,
          gameOnly: gameOnly || undefined,
          leg,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setSubmitting(true);
        await api.post('/posts', parsed.data);
        onPosted('group');
      } else {
        const parsed = joinGroupSchema.safeParse({ leg });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        setSubmitting(true);
        await api.post(`/posts/${mode.postId}/legs`, parsed.data);
        onPosted('leg');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your leg'));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-gray-400 hover:text-white"
        >
          ‹ Pick a different leg
        </button>

        <div className="rounded-xl border border-gray-800 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Your leg
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold leading-snug">
                {selectionTitle(selection)}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {selection.marketLabel}
              </p>
              <p className="mt-1 text-xs text-emerald-400">
                {selection.eventLabel}
              </p>
            </div>
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatAmerican(selection.outcome.price)}
            </span>
          </div>
        </div>

        {starting ? (
          <>
            <p className="text-sm text-gray-400">
              Friends add one leg each until the deadline, or until you lock it.
              Then everyone can place it at {bookName}. Group parlays keep their
              own record, so they won&apos;t touch anyone&apos;s personal stats.
            </p>
            <label
              htmlFor="group-game-only"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                gameOnly
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <input
                id="group-game-only"
                type="checkbox"
                checked={gameOnly}
                onChange={(e) => setGameOnly(e.target.checked)}
                className="mt-1 h-4 w-4 accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold">
                  🎯 This game only
                </span>
                <span className="block text-xs text-gray-400">
                  Every leg has to come from {selection.eventLabel}.
                </span>
              </span>
            </label>
            <label htmlFor="group-lock" className="block">
              <span className="mb-1 block text-xs font-medium text-gray-400">
                Lock by (Central time)
              </span>
              <input
                id="group-lock"
                type="datetime-local"
                required
                value={lockAt}
                min={toSiteInput(now)}
                max={toSiteInput(latest)}
                onChange={(e) => setLockAt(e.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-gray-500">
                Defaults to your game&apos;s start. You can lock it early.
              </span>
            </label>
            <label htmlFor="group-caption" className="block">
              <span className="mb-1 block text-xs font-medium text-gray-400">
                Caption
              </span>
              <textarea
                id="group-caption"
                rows={2}
                maxLength={500}
                placeholder="Sunday group parlay. Everyone gets one leg."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className={inputClass}
              />
            </label>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            This leg goes on the group parlay with your name on it. You can take
            it back out until it locks.
          </p>
        )}
      </div>

      <div className="border-t border-gray-800 bg-gray-950 px-5 py-4">
        {error && (
          <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {submitting && 'Saving…'}
          {!submitting && (starting ? 'Start group parlay' : 'Add my leg')}
        </button>
      </div>
    </form>
  );
}
