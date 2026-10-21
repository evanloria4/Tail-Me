import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api from '../lib/api';
import { lockTime } from '../lib/time';
import useNow from '../lib/useNow';
import { allFinal, isLive } from '../../shared/live';
import { isGroupLocked } from '../../shared/posts';
import type { FeedPost } from '../../shared/posts';
import { legText, LiveBadge, slipTitle } from './SlipParts';
import UserAvatar from './UserAvatar';

// What's in play right now, beside the feed: group parlays still taking legs
// or waiting on games, and every slip with a game on. Clicking a row scrolls
// the feed to that slip (the feed pages down to find it if needed).

/** Refreshes on its own so LIVE rows come and go without a reload */
const REFRESH_MS = 2 * 60_000;

type Active = { groups: FeedPost[]; live: FeedPost[] };

export function useActiveSlips(reloadKey?: unknown) {
  const [data, setData] = useState<Active | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .get<Active>('/posts/active')
        .then(({ data: body }) => live && setData(body))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [reloadKey]);
  return data;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-3 pt-3">
      <h2 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

const rowClass =
  '-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-gray-800';

const chip = 'rounded-md px-1.5 py-px text-[10px] font-bold tracking-wide';

/** Where a group parlay stands, as one short chip */
function GroupStatus({ post, now }: { post: FeedPost; now: number }) {
  const { group } = post;
  const { legs } = post.bets[0];
  if (group && !isGroupLocked(group, new Date(now))) {
    return (
      <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>
        OPEN · locks {lockTime(group.lockAt)}
      </span>
    );
  }
  if (isLive(legs, now)) return <LiveBadge />;
  if (allFinal(legs, now))
    return <span className={`${chip} bg-gray-800 text-gray-300`}>PENDING</span>;
  return <span className={`${chip} bg-gray-800 text-gray-300`}>LOCKED</span>;
}

export function GroupParlaysPanel({
  posts,
  onOpen,
}: {
  posts: FeedPost[];
  onOpen: (postId: string) => void;
}) {
  const { profile } = useAuth();
  const now = useNow();
  return (
    <Panel title="Group parlays">
      {posts.length ? (
        <ul className="divide-y divide-gray-800">
          {posts.map((post) => {
            const { legs } = post.bets[0];
            const mine = legs.some((l) => l.addedBy?.id === profile?.id);
            return (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onOpen(post.id)}
                  className={rowClass}
                >
                  <span className="text-lg" aria-hidden="true">
                    👥
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {legs.length}-leg group parlay
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <GroupStatus post={post} now={now} />
                      <span className="text-xs text-gray-500">
                        {mine
                          ? 'You’re in'
                          : `by ${post.author.fullName.split(' ')[0]}`}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-gray-500">
          No group parlays right now. Start one with the + button, then 👥 Group
          parlay.
        </p>
      )}
    </Panel>
  );
}

export function LiveNowPanel({
  posts,
  onOpen,
}: {
  posts: FeedPost[];
  onOpen: (postId: string) => void;
}) {
  return (
    <Panel title="Live now">
      {posts.length ? (
        <ul className="divide-y divide-gray-800">
          {posts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => onOpen(post.id)}
                className={rowClass}
              >
                <UserAvatar
                  name={post.author.fullName}
                  url={post.author.avatarUrl}
                  className="h-7 w-7 text-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {post.type === 'STRAIGHT'
                      ? legText(post.bets[0].legs[0]).title
                      : slipTitle(post)}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {post.author.fullName}
                  </span>
                </span>
                <span
                  aria-label="Live"
                  className="h-2 w-2 flex-none rounded-full bg-red-400"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-gray-500">
          Nothing live right now. Slips show up here while their games are on.
        </p>
      )}
    </Panel>
  );
}
