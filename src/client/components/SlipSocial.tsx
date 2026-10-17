import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import timeAgo from '../lib/time';
import { formatAmerican } from '../../shared/odds';
import { isHot, SlipBadge } from '../../shared/badges';
import { COMMENT_MAX, REACTION_EMOJIS } from '../../shared/social';
import type {
  FeedComment,
  ReactionEmoji,
  ReactionSummary,
  Tailer,
  Vote,
} from '../../shared/social';
import type { Streak } from '../../shared/stats';

// The social layer on a slip card: streak + achievement badges, who tailed,
// reactions and comments.

/** "🔥 4 straight" beside a hot poster's name */
export function StreakChip({ streak }: { streak: Streak | null }) {
  if (!isHot(streak)) return null;
  return (
    <span
      title={`Won ${streak.count} bets in a row`}
      className="inline-flex flex-none items-center gap-0.5 rounded-full bg-orange-400/15 px-2 py-0.5 text-xs font-bold text-orange-400"
    >
      🔥 {streak.count} straight
    </span>
  );
}

/** Whether a slip gets the gold "cashed" treatment */
export const isCelebrated = (badges: SlipBadge[]) =>
  badges.some((b) => b.kind === 'BIG_WIN' || b.kind === 'SWEEP');

/** Gold strip across the top of a slip that hit big */
export function WinBanner({ badges }: { badges: SlipBadge[] }) {
  const parts = badges.flatMap((b) => {
    if (b.kind === 'BIG_WIN') return [`💰 Cashed at ${formatAmerican(b.odds)}`];
    if (b.kind === 'SWEEP') return [`🪜 Clean sweep · ${b.rungs}/${b.rungs}`];
    return [];
  });
  if (!parts.length) return null;
  return (
    <div className="border-b border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-sm font-bold text-yellow-300">
      {parts.join('  ·  ')}
    </div>
  );
}

export function CrowdChip({ badges }: { badges: SlipBadge[] }) {
  const popular = badges.find((b) => b.kind === 'POPULAR');
  if (!popular) return null;
  return (
    <span
      title={`${popular.tails} people tailed this`}
      className="flex-none rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400"
    >
      👥 Crowd pick
    </span>
  );
}

/** Closes a popover on Escape or a click outside `ref` */
function useDismiss(
  open: boolean,
  close: () => void,
  ref: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, close, ref]);
}

/** "3 tails" — opens the list of who tailed */
export function TailersButton({
  postId,
  count,
}: {
  postId: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [tailers, setTailers] = useState<Tailer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const label = `${count} ${count === 1 ? 'tail' : 'tails'}`;
  useDismiss(open, () => setOpen(false), ref);

  // Refetch each time it opens; the count may have moved
  useEffect(() => {
    if (!open) return;
    api
      .get<Tailer[]>(`/posts/${postId}/tails`)
      .then(({ data }) => setTailers(data))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load tails')));
  }, [open, postId, count]);

  if (!count) return <span>{label}</span>;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="font-medium hover:text-white hover:underline"
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-60 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
          <p className="border-b border-gray-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Tailed by
          </p>
          {error && <p className="px-3 py-2 text-sm text-red-400">{error}</p>}
          {!tailers && !error && (
            <p className="px-3 py-2 text-sm text-gray-500">Loading…</p>
          )}
          <ul className="max-h-64 overflow-y-auto">
            {tailers?.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/u/${t.username}`}
                  className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-gray-800"
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400">
                    {t.fullName[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {t.fullName}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      @{t.username} · {timeAgo(t.tailedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const chipClass = (active: boolean) =>
  `inline-flex h-7 items-center gap-1 rounded-full border px-2 text-sm tabular-nums transition ${
    active
      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
      : 'border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
  }`;

/** Reacted emoji as counted chips, plus a picker for the rest */
export function ReactionBar({
  reactions,
  onReact,
}: {
  reactions: ReactionSummary[];
  onReact: (emoji: ReactionEmoji) => void;
}) {
  const [picking, setPicking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(picking, () => setPicking(false), ref);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}`}
          className={chipClass(r.mine)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="text-xs font-semibold">{r.count}</span>
        </button>
      ))}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          aria-label="Add reaction"
          title="React"
          className={chipClass(false)}
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="10" r="6.5" />
            <path d="M6.5 11.8c.7.9 1.5 1.3 2.5 1.3s1.8-.4 2.5-1.3M7 8h.01M11 8h.01M16 2.5v4M14 4.5h4" />
          </svg>
        </button>
        {picking && (
          <div className="absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-full border border-gray-800 bg-gray-900 p-1 shadow-xl">
            {REACTION_EMOJIS.map((emoji) => {
              const mine = reactions.some((r) => r.emoji === emoji && r.mine);
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={mine}
                  onClick={() => {
                    onReact(emoji);
                    setPicking(false);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:scale-110 hover:bg-gray-800 ${
                    mine ? 'bg-emerald-500/15' : ''
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentsToggle({
  count,
  open,
  onClick,
}: {
  count: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-sm transition ${
        open ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 4.5h13v9h-7l-3.5 3v-3h-2.5z" />
      </svg>
      {count > 0 ? count : 'Comment'}
      <span className="sr-only">{count === 1 ? 'comment' : 'comments'}</span>
    </button>
  );
}

function VoteButtons({
  comment,
  onVote,
}: {
  comment: FeedComment;
  onVote: (value: Vote) => void;
}) {
  const button = (value: 1 | -1, icon: string, n: number, label: string) => {
    const active = comment.myVote === value;
    const activeColor = value === 1 ? 'text-emerald-400' : 'text-red-400';
    return (
      <button
        type="button"
        onClick={() => onVote(active ? 0 : value)}
        aria-pressed={active}
        aria-label={`${label} (${n})`}
        className={`inline-flex items-center gap-1 rounded px-1 text-xs tabular-nums transition ${
          active ? activeColor : 'text-gray-500 hover:text-white'
        }`}
      >
        <span aria-hidden="true">{icon}</span>
        {n > 0 && n}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-1">
      {button(1, '👍', comment.likes, 'Like')}
      {button(-1, '👎', comment.dislikes, 'Dislike')}
    </div>
  );
}

/** Thread under a slip; `onCount` keeps the card's comment count in step */
export function Comments({
  postId,
  onCount,
}: {
  postId: string;
  onCount: (n: number) => void;
}) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<FeedComment[]>(`/posts/${postId}/comments`)
      .then(({ data }) => {
        setComments(data);
        onCount(data.length);
      })
      .catch((err) =>
        setError(apiErrorMessage(err, 'Could not load comments'))
      );
    // onCount is a fresh closure each render; loading once per slip is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const replace = (c: FeedComment) =>
    setComments((prev) => prev?.map((x) => (x.id === c.id ? c : x)) ?? null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post<FeedComment>(
        `/posts/${postId}/comments`,
        { body: draft }
      );
      const next = [...(comments ?? []), data];
      setComments(next);
      onCount(next.length);
      setDraft('');
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not post the comment'));
    } finally {
      setSending(false);
    }
  };

  const vote = async (comment: FeedComment, value: Vote) => {
    // Optimistic: move the viewer's vote, then take the server's counts
    const delta = (v: Vote, side: 1 | -1) =>
      (v === side ? 1 : 0) - (comment.myVote === side ? 1 : 0);
    replace({
      ...comment,
      myVote: value,
      likes: comment.likes + delta(value, 1),
      dislikes: comment.dislikes + delta(value, -1),
    });
    try {
      const { data } = await api.put<FeedComment>(
        `/comments/${comment.id}/vote`,
        { value }
      );
      replace(data);
    } catch (err) {
      replace(comment);
      setError(apiErrorMessage(err, 'Could not save the vote'));
    }
  };

  const remove = async (comment: FeedComment) => {
    try {
      await api.delete(`/comments/${comment.id}`);
      const next = (comments ?? []).filter((c) => c.id !== comment.id);
      setComments(next);
      onCount(next.length);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the comment'));
    }
  };

  return (
    <div className="space-y-3">
      {!comments && !error && (
        <p className="text-sm text-gray-500">Loading comments…</p>
      )}
      {comments?.length === 0 && (
        <p className="text-sm text-gray-500">No comments yet.</p>
      )}
      {comments && comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Link
                to={`/u/${c.author.username}`}
                aria-hidden="true"
                tabIndex={-1}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400"
              >
                {c.author.fullName[0]}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <Link
                    to={`/u/${c.author.username}`}
                    className="font-semibold text-white hover:underline"
                  >
                    {c.author.fullName}
                  </Link>{' '}
                  <span className="text-xs text-gray-500">
                    {timeAgo(c.createdAt)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-gray-200">
                  {c.body}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <VoteButtons comment={c} onVote={(v) => vote(c, v)} />
                  {(c.author.id === profile?.id || profile?.isAdmin) && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="text-xs text-gray-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          aria-label="Add a comment"
          rows={1}
          value={draft}
          maxLength={COMMENT_MAX}
          placeholder="Add a comment…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a line
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-[2.25rem] flex-1 resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="h-9 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Post
        </button>
      </form>
    </div>
  );
}
