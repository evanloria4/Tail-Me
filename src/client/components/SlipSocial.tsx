import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import timeAgo from '../lib/time';
import UserAvatar from './UserAvatar';
import { formatAmerican, payout } from '../../shared/odds';
import { isHot, slipTier, WIN_TIERS } from '../../shared/badges';
import type { SlipBadge, WinTier } from '../../shared/badges';
import {
  COMMENT_MAX,
  REACTION_EMOJIS,
  REACTION_LABELS,
} from '../../shared/social';
import type {
  FeedComment,
  PersonRef,
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

/**
 * How a winning slip looks at each tier (`WIN_TIERS`): the card's border,
 * the slip's border and the banner across its top. Louder as the price grows.
 */
export const TIER_STYLES: Record<
  WinTier,
  { emoji: string; card: string; slip: string; banner: string }
> = {
  1: {
    emoji: '✅',
    card: 'border-emerald-500/40',
    slip: 'border-emerald-500/40',
    banner: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  2: {
    emoji: '💰',
    card: 'border-yellow-300/50',
    slip: 'border-yellow-300/40',
    banner: 'border-yellow-300/30 bg-yellow-300/10 text-yellow-300',
  },
  3: {
    emoji: '💎',
    card: 'border-violet-400/50 shadow-lg shadow-violet-400/15',
    slip: 'border-violet-400/50',
    banner: 'border-violet-400/30 bg-violet-400/10 text-violet-400',
  },
  4: {
    emoji: '🚨',
    card: 'border-pink-400/60 shadow-xl shadow-pink-400/25',
    slip: 'border-pink-400/60',
    banner:
      'border-pink-400/40 bg-gradient-to-r from-yellow-300/20 via-pink-400/25 to-yellow-300/20 bg-[length:200%_100%] py-3 text-base text-pink-400 animate-shimmer motion-reduce:animate-none',
  },
};

/** Strip across the top of a winning slip, styled by its tier */
export function WinBanner({
  badges,
  ladder,
}: {
  badges: SlipBadge[];
  /** Ladders pay in units, so the banner names the top rung instead */
  ladder: boolean;
}) {
  const tier = slipTier(badges);
  if (!tier) return null;
  const parts = badges.flatMap((b) => {
    if (b.kind === 'WIN') {
      const { name } = WIN_TIERS[b.tier - 1];
      const odds = formatAmerican(b.odds);
      return [
        ladder
          ? `${name} · top rung ${odds}`
          : `${name} · ${odds} · $10 paid $${Math.round(payout(10, b.decimal))}`,
      ];
    }
    if (b.kind === 'SWEEP') return [`🪜 Clean sweep · ${b.rungs}/${b.rungs}`];
    return [];
  });
  const style = TIER_STYLES[tier];
  return (
    <div className={`border-b px-4 py-2 text-sm font-bold ${style.banner}`}>
      {badges.some((b) => b.kind === 'WIN') && `${style.emoji} `}
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
      🔒 Group lock
    </span>
  );
}

/** Closes a popover on Escape or a click outside `ref` */
export function useDismiss(
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

/** The latest tailers' faces, overlapped */
function TailerStack({ people }: { people: PersonRef[] }) {
  return (
    <span className="flex flex-none -space-x-1.5">
      {people.map((p) => (
        // Solid backing + card-colored ring so overlapped initials stay crisp
        <span
          key={p.id}
          className="rounded-full bg-gray-900 ring-2 ring-gray-900"
        >
          <UserAvatar
            name={p.fullName}
            url={p.avatarUrl}
            className="h-5 w-5 text-[10px]"
          />
        </span>
      ))}
    </span>
  );
}

/** Faces + "5 tails" (or "2 fades") — opens the list of who did it */
export function TailersButton({
  postId,
  count,
  recent = [],
  kind = 'tail',
}: {
  postId: string;
  /** Distinct people who tailed (or faded) */
  count: number;
  /** Latest few, shown as overlapped faces */
  recent?: PersonRef[];
  kind?: 'tail' | 'fade';
}) {
  const [open, setOpen] = useState(false);
  const [tailers, setTailers] = useState<Tailer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const label = `${count} ${kind}${count === 1 ? '' : 's'}`;
  useDismiss(open, () => setOpen(false), ref);

  // Refetch each time it opens; the count may have moved
  useEffect(() => {
    if (!open) return;
    api
      .get<Tailer[]>(`/posts/${postId}/${kind}s`)
      .then(({ data }) => setTailers(data))
      .catch((err) =>
        setError(apiErrorMessage(err, `Could not load ${kind}s`))
      );
  }, [open, postId, count, kind]);

  if (!count) return <span>{label}</span>;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex items-center gap-2 font-medium hover:text-white"
      >
        {recent.length > 0 && <TailerStack people={recent} />}
        <span className="group-hover:underline">{label}</span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-60 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl">
          <p className="border-b border-gray-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {kind === 'tail' ? 'Tailed' : 'Faded'} by {count}
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
                  title={`@${t.username}`}
                  className="flex items-center gap-2 px-3 py-1.5 transition hover:bg-gray-800"
                >
                  <UserAvatar
                    name={t.fullName}
                    url={t.avatarUrl}
                    className="h-5 w-5 text-[10px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                    {t.fullName}
                  </span>
                  <span className="flex-none text-xs tabular-nums text-gray-500">
                    {timeAgo(t.tailedAt)}
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

  // The picker anchors to the whole bar, not the + button, so it stays on
  // screen however many chips sit before it
  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onReact(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${REACTION_LABELS[r.emoji]} ${r.count}`}
          title={REACTION_LABELS[r.emoji]}
          className={chipClass(r.mine)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="text-xs font-semibold">{r.count}</span>
        </button>
      ))}
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
        // Fixed 40px columns (w-max), or it shrinks to the narrow bar it anchors
        // to. 5 x 40px + gaps + padding = 232px, fits the smallest phones.
        <div className="absolute bottom-full left-0 z-10 mb-2 grid w-max grid-cols-[repeat(5,2.5rem)] gap-1 rounded-2xl border border-gray-800 bg-gray-900 p-2 shadow-xl">
          {REACTION_EMOJIS.map((emoji) => {
            const mine = reactions.some((r) => r.emoji === emoji && r.mine);
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                aria-label={REACTION_LABELS[emoji]}
                title={REACTION_LABELS[emoji]}
                onClick={() => {
                  onReact(emoji);
                  setPicking(false);
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition hover:scale-110 hover:bg-gray-800 ${
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
                className="flex-none"
              >
                <UserAvatar
                  name={c.author.fullName}
                  url={c.author.avatarUrl}
                  className="h-8 w-8 text-xs"
                />
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
