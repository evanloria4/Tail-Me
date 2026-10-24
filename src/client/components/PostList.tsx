import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import scrollToSlip from '../lib/scrollToSlip';
import useAutoRefresh from '../lib/useAutoRefresh';
import PostCard, { BackAction } from './PostCard';
import type { GroupHandlers } from './GroupParlay';
import type { RungInput } from './SlipMenu';
import useConfirm from './ConfirmDialog';
import PostComposer from './PostComposer';
import { useToast } from './Toast';
import { DELETE_GRACE_MINUTES, deleteRule } from '../../shared/posts';
import type { BetResult, FeedLeg, FeedPost } from '../../shared/posts';
import { gameState } from '../../shared/live';
import type { StatRange } from '../../shared/stats';
import { REACTION_EMOJIS } from '../../shared/social';
import type { ReactionEmoji, ReactionSummary } from '../../shared/social';

type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

/** How far down the feed a panel click will page looking for a slip */
const MAX_FOCUS_PAGES = 10;

/** Stop watching an ungraded leg this long after its game started */
const WATCH_FOR_MS = 24 * 60 * 60_000;

/** A leg whose game is on, or over with its bet still waiting on a grade */
function watching(leg: FeedLeg, betResult: BetResult, now: number) {
  if (!leg.startsAt || now - Date.parse(leg.startsAt) > WATCH_FOR_MS) {
    return false;
  }
  const state = gameState(leg.startsAt, leg.gameFinal, now);
  return state === 'live' || (state === 'final' && betResult === 'PENDING');
}

/** Optimistic flip of the viewer's reaction, kept in the fixed emoji order */
function toggleReaction(
  reactions: ReactionSummary[],
  emoji: ReactionEmoji
): ReactionSummary[] {
  const current = reactions.find((r) => r.emoji === emoji);
  const next = current
    ? {
        ...current,
        mine: !current.mine,
        count: current.count + (current.mine ? -1 : 1),
      }
    : { emoji, count: 1, mine: true };
  return REACTION_EMOJIS.map((e) =>
    e === emoji ? next : reactions.find((r) => r.emoji === e)
  ).filter((r): r is ReactionSummary => !!r && r.count > 0);
}

/**
 * Paged list of slips with settle / tail / delete wired up. The feed shows
 * everyone; profiles pass `author`. `onChange` fires after a settle or delete
 * so a page can refresh anything derived from results (profile stats).
 */
export default function PostList({
  author,
  series,
  range,
  reloadKey,
  empty,
  onChange,
  focusId,
  onFocusDone,
}: {
  /** A slip to scroll to; pages load until it's found (or give up) */
  focusId?: string | null;
  onFocusDone?: (found: boolean) => void;
  author?: string;
  /** One series' slips */
  series?: string;
  range?: StatRange;
  /** Change it to reload from the top (e.g. after a new post) */
  reloadKey?: unknown;
  empty: React.ReactNode;
  onChange?: () => void;
}) {
  const { profile } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const toast = useToast();
  /** The author's slip open in the composer for editing */
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      try {
        const { data } = await api.get<FeedPage>('/posts', {
          params: { cursor: after, author, range, series },
        });
        setPosts((prev) => (after ? [...prev, ...data.posts] : data.posts));
        setCursor(data.nextCursor);
        setError(null);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load slips'));
      } finally {
        setLoading(false);
      }
    },
    [author, range, series]
  );

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Scroll to focusId, loading more pages while it isn't on the page yet
  const focusPages = useRef(0);
  useEffect(() => {
    focusPages.current = 0;
  }, [focusId]);
  useEffect(() => {
    if (!focusId || loading) return;
    if (posts.some((p) => p.id === focusId)) {
      // Wait a frame so the card is in the DOM
      requestAnimationFrame(() => onFocusDone?.(scrollToSlip(focusId)));
    } else if (cursor && focusPages.current < MAX_FOCUS_PAGES) {
      focusPages.current += 1;
      load(cursor);
    } else {
      onFocusDone?.(false);
    }
  }, [focusId, loading, posts, cursor, load, onFocusDone]);

  // Slips with a game on (or just over and waiting on a grade) reload every
  // couple of minutes, matching the grader, so a leg that hits or busts
  // mid-game shows without a page refresh
  const postsRef = useRef(posts);
  postsRef.current = posts;
  useAutoRefresh(async () => {
    const now = Date.now();
    const ids = postsRef.current
      .filter((p) =>
        p.bets.some((b) => b.legs.some((l) => watching(l, b.result, now)))
      )
      .map((p) => p.id);
    if (!ids.length) return;
    try {
      const { data } = await api.get<FeedPost[]>('/posts/refresh', {
        params: { ids: ids.join(',') },
      });
      const fresh = new Map(data.map((p) => [p.id, p]));
      setPosts((prev) => prev.map((p) => fresh.get(p.id) ?? p));
    } catch {
      // Next tick tries again
    }
  });

  const settle = async (betId: string, result: BetResult) => {
    const update = (r: BetResult) =>
      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          bets: p.bets.map((b) => (b.id === betId ? { ...b, result: r } : b)),
        }))
      );
    const previous = posts
      .flatMap((p) => p.bets)
      .find((b) => b.id === betId)?.result;
    update(result);
    try {
      const { data } = await api.patch<FeedPost>(`/posts/bets/${betId}`, {
        result,
      });
      // The poster's streak shows on every one of their slips
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === data.id) return data;
          if (p.author.id === data.author.id) {
            return {
              ...p,
              author: { ...p.author, streak: data.author.streak },
            };
          }
          return p;
        })
      );
      onChange?.();
    } catch (err) {
      if (previous) update(previous);
      setError(apiErrorMessage(err, 'Could not update the result'));
    }
  };

  const react = async (postId: string, emoji: ReactionEmoji) => {
    const setReactions = (reactions: ReactionSummary[]) =>
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, reactions } : p))
      );
    const before = posts.find((p) => p.id === postId)?.reactions ?? [];
    setReactions(toggleReaction(before, emoji));
    try {
      const { data } = await api.post<ReactionSummary[]>(
        `/posts/${postId}/reactions`,
        { emoji }
      );
      setReactions(data);
    } catch (err) {
      setReactions(before);
      setError(apiErrorMessage(err, 'Could not save the reaction'));
    }
  };

  // Tail / fade and their undos. On a tail the card has already opened the
  // book (links must open inside the click to get past popup blockers)
  const back = async (postId: string, action: BackAction) => {
    const path = action.endsWith('fade') ? 'fade' : 'tail';
    try {
      const { data } = action.startsWith('un')
        ? await api.delete<FeedPost>(`/posts/${postId}/${path}`)
        : await api.post<FeedPost>(`/posts/${postId}/${path}`);
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
      onChange?.();
    } catch (err) {
      setError(apiErrorMessage(err, `Could not save the ${path}`));
    }
  };

  // Says up front what deleting does to the record (see deleteRule), so
  // nobody deletes a loser expecting it to vanish from their stats
  const remove = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const isAdmin = !!profile?.isAdmin;
    const rule = deleteRule(post, new Date(), isAdmin);
    // An admin removing someone else's slip
    const whose =
      post.author.id === profile?.id
        ? 'your'
        : `${post.author.fullName.split(' ')[0]}’s`;
    if (rule === 'blocked') {
      await confirm({
        title: 'Settle it first',
        message: `Slips with open bets can only be deleted within ${DELETE_GRACE_MINUTES} minutes of posting. Mark the result, then you can delete it. It will still count toward your record.`,
        confirmLabel: 'Got it',
        alert: true,
      });
      return;
    }
    const ok = await confirm({
      title: 'Delete this slip?',
      message:
        rule === 'hide'
          ? `It comes off the feed for everyone, but it still counts toward ${whose} record. Deleting a slip never changes wins, losses or units.`
          : `It comes off the feed for everyone and won’t count toward ${whose} record, since it hasn’t been settled yet.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      onChange?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete the post'));
    }
  };

  const replacePost = (data: FeedPost) =>
    setPosts((prev) => prev.map((p) => (p.id === data.id ? data : p)));

  const setOdds = async (betId: string, americanOdds: number) => {
    try {
      const { data } = await api.put<FeedPost>(`/posts/bets/${betId}/odds`, {
        americanOdds,
      });
      replacePost(data);
      onChange?.();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the odds'));
      return false;
    }
  };

  const setUnits = async (betId: string, units: number) => {
    try {
      const { data } = await api.put<FeedPost>(`/posts/bets/${betId}/units`, {
        units,
      });
      replacePost(data);
      onChange?.();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the units'));
      return false;
    }
  };

  const addRung = async (postId: string, rung: RungInput) => {
    try {
      const { data } = await api.post<FeedPost>(`/posts/${postId}/rungs`, rung);
      replacePost(data);
      onChange?.();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add the rung'));
      return false;
    }
  };

  const moveSeries = async (postId: string, seriesId: string | null) => {
    try {
      const { data } = await api.put<FeedPost>(`/posts/${postId}/series`, {
        seriesId,
      });
      // On a series page, a slip moved out of it leaves the list
      if (series && data.series?.id !== series) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        replacePost(data);
      }
      onChange?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not move the slip'));
    }
  };

  const groupHandlers: GroupHandlers = {
    settleLeg: async (postId, legId, result) => {
      const before = posts.find((p) => p.id === postId);
      if (before) {
        replacePost({
          ...before,
          bets: before.bets.map((b) => ({
            ...b,
            legs: b.legs.map((l) => (l.id === legId ? { ...l, result } : l)),
          })),
        });
      }
      try {
        const { data } = await api.patch<FeedPost>(`/posts/legs/${legId}`, {
          result,
        });
        replacePost(data);
        onChange?.();
      } catch (err) {
        if (before) replacePost(before);
        setError(apiErrorMessage(err, 'Could not settle the leg'));
      }
    },
    removeLeg: async (postId, legId) => {
      const ok = await confirm({
        title: 'Take this leg out?',
        message:
          'It comes off the group parlay. A new leg can go in its place.',
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!ok) return;
      try {
        const { data } = await api.delete<FeedPost>(
          `/posts/${postId}/legs/${legId}`
        );
        replacePost(data);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not remove the leg'));
      }
    },
    lock: async (postId) => {
      const ok = await confirm({
        title: 'Lock the group parlay?',
        message:
          'No more legs can be added. Everyone can place it once it’s locked.',
        confirmLabel: 'Lock it',
      });
      if (!ok) return;
      try {
        const { data } = await api.post<FeedPost>(`/posts/${postId}/lock`);
        replacePost(data);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not lock it'));
      }
    },
    setPrice: async (postId, americanOdds) => {
      try {
        const { data } = await api.put<FeedPost>(`/posts/${postId}/price`, {
          americanOdds,
        });
        replacePost(data);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not save the price'));
      }
    },
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && posts.length === 0 && !error && empty}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={profile?.id}
          isAdmin={!!profile?.isAdmin}
          onSettle={settle}
          onDelete={remove}
          onBack={back}
          onReact={react}
          onMoveSeries={moveSeries}
          onEdit={setEditing}
          onOdds={setOdds}
          onUnits={setUnits}
          onAddRung={addRung}
          groupHandlers={groupHandlers}
        />
      ))}

      <PostComposer
        open={!!editing}
        edit={editing}
        onClose={() => setEditing(null)}
        onPosted={() => setEditing(null)}
        onSaved={(post) => {
          setEditing(null);
          replacePost(post);
          onChange?.();
          toast('Slip updated');
        }}
      />

      {loading && <p className="py-6 text-center text-gray-500">Loading…</p>}

      {!loading && cursor && (
        <button
          type="button"
          onClick={() => load(cursor)}
          className="w-full rounded-lg border border-gray-800 py-2 text-gray-300 hover:bg-gray-900"
        >
          Load more
        </button>
      )}
    </div>
  );
}
