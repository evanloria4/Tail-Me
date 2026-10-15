import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import PostCard from '../components/PostCard';
import { useLayout } from '../components/AppLayout';
import useConfirm from '../components/ConfirmDialog';
import type { BetResult, FeedPost } from '../../shared/posts';

type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

export default function Feed() {
  const { profile, isSubscribed } = useAuth();
  const { openComposer, feedVersion } = useLayout();
  const [confirm, confirmDialog] = useConfirm();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<FeedPage>('/posts', {
        params: after ? { cursor: after } : undefined,
      });
      setPosts((prev) => (after ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the feed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, feedVersion]);

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

      {!loading && posts.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-gray-800 p-10 text-center">
          <p className="text-gray-400">No slips yet.</p>
          {isSubscribed && (
            <button
              type="button"
              onClick={openComposer}
              className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-gray-950 hover:bg-emerald-400"
            >
              Post the first one
            </button>
          )}
        </div>
      )}

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
