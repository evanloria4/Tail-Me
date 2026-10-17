import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import PostCard from './PostCard';
import useConfirm from './ConfirmDialog';
import type { BetResult, FeedPost } from '../../shared/posts';
import type { StatRange } from '../../shared/stats';

type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

/**
 * Paged list of slips with settle / tail / delete wired up. The feed shows
 * everyone; profiles pass `author`. `onChange` fires after a settle or delete
 * so a page can refresh anything derived from results (profile stats).
 */
export default function PostList({
  author,
  range,
  reloadKey,
  empty,
  onChange,
}: {
  author?: string;
  range?: StatRange;
  /** Change it to reload from the top (e.g. after a new post) */
  reloadKey?: unknown;
  empty: React.ReactNode;
  onChange?: () => void;
}) {
  const { profile } = useAuth();
  const [confirm, confirmDialog] = useConfirm();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after?: string) => {
      setLoading(true);
      try {
        const { data } = await api.get<FeedPage>('/posts', {
          params: { cursor: after, author, range },
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
    [author, range]
  );

  useEffect(() => {
    load();
  }, [load, reloadKey]);

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
      await api.patch(`/posts/bets/${betId}`, { result });
      onChange?.();
    } catch (err) {
      if (previous) update(previous);
      setError(apiErrorMessage(err, 'Could not update the result'));
    }
  };

  // Records the tail; the card has already opened the book (links must open
  // inside the click to get past popup blockers)
  const tail = async (postId: string) => {
    try {
      const { data } = await api.post<FeedPost>(`/posts/${postId}/tail`);
      setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)));
      onChange?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not record the tail'));
    }
  };

  const remove = async (postId: string) => {
    const ok = await confirm({
      title: 'Delete this slip?',
      message: 'It will be removed from the feed for everyone.',
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
          onSettle={settle}
          onDelete={remove}
          onTail={tail}
        />
      ))}

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
