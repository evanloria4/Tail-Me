import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import api from '../lib/api';
import { lockTime } from '../lib/time';
import useNow from '../lib/useNow';
import useAutoRefresh from '../lib/useAutoRefresh';
import { allFinal, isLive } from '../../shared/live';
import { isGroupLocked } from '../../shared/posts';
import type { FeedPost } from '../../shared/posts';
import { legText, LiveBadge, slipTitle } from './SlipParts';
import { SeriesBadge } from './SeriesCover';
import UserAvatar from './UserAvatar';
import { SERIES_COLORS } from '../../shared/series';

// What's in play right now, beside the feed: group parlays still taking legs
// or waiting on games, and every slip with a game on. Clicking a row scrolls
// the feed to that slip (the feed pages down to find it if needed).

type Active = { groups: FeedPost[]; live: FeedPost[] };

/** Refreshes on its own so LIVE rows come and go without a reload */
export function useActiveSlips(reloadKey?: unknown) {
  const [data, setData] = useState<Active | null>(null);
  const [tick, setTick] = useState(0);
  useAutoRefresh(() => setTick((t) => t + 1));
  useEffect(() => {
    let live = true;
    api
      .get<Active>('/posts/active')
      .then(({ data: body }) => live && setData(body))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [reloadKey, tick]);
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

/** Covers for the group parlay rows: no two on screen share an emoji */
const GROUP_EMOJIS = [
  '🎯',
  '🔥',
  '🚀',
  '💰',
  '🎲',
  '⚡',
  '🍀',
  '👑',
  '💎',
  '🦈',
  '🐐',
  '🃏',
];

const hash = (id: string) =>
  [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1_000_003, 7);

/** Each post's emoji + color, stable per post, unique within the list */
function groupCovers(posts: FeedPost[]) {
  const taken = new Set<number>();
  return new Map(
    posts.map((post) => {
      const h = hash(post.id);
      let i = h % GROUP_EMOJIS.length;
      while (taken.has(i) && taken.size < GROUP_EMOJIS.length) {
        i = (i + 1) % GROUP_EMOJIS.length;
      }
      taken.add(i);
      const color = SERIES_COLORS[Math.floor(h / 16) % SERIES_COLORS.length];
      return [post.id, { emoji: GROUP_EMOJIS[i], color }];
    })
  );
}

const firstStart = (legs: FeedPost['bets'][number]['legs']) =>
  legs
    .map((l) => l.startsAt)
    .filter((t): t is string => !!t)
    .sort()[0] ?? null;

/**
 * Where a group parlay stands, always as a chip plus a short detail: open
 * until it locks, then locked, live, waiting on a grade, hit or busted.
 * A leg that busts mid-game shows here as soon as the grader catches it.
 */
function GroupStatus({ post, now }: { post: FeedPost; now: number }) {
  const { group } = post;
  const bet = post.bets[0];
  const { legs } = bet;
  const hit = legs.filter((l) => l.result === 'WON').length;
  const progress = `${hit}/${legs.length} hit`;
  let tag: React.ReactNode;
  let detail: string;
  if (bet.result === 'WON') {
    tag = (
      <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>
        HIT ✓
      </span>
    );
    detail = progress;
  } else if (bet.result === 'LOST') {
    tag = <span className={`${chip} bg-red-400/15 text-red-400`}>BUSTED</span>;
    detail = progress;
  } else if (bet.result !== 'PENDING') {
    tag = (
      <span className={`${chip} bg-gray-800 text-gray-300`}>{bet.result}</span>
    );
    detail = progress;
  } else if (group && !isGroupLocked(group, new Date(now))) {
    tag = (
      <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>OPEN</span>
    );
    detail = `Locks ${lockTime(group.lockAt)}`;
  } else if (isLive(legs, now)) {
    tag = <LiveBadge />;
    detail = progress;
  } else if (allFinal(legs, now)) {
    tag = <span className={`${chip} bg-gray-800 text-gray-300`}>PENDING</span>;
    detail = progress;
  } else {
    tag = <span className={`${chip} bg-gray-800 text-gray-300`}>LOCKED</span>;
    const start = firstStart(legs);
    detail = start ? `Starts ${lockTime(start)}` : progress;
  }
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {tag}
      <span className="text-xs text-gray-500">{detail}</span>
    </span>
  );
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
  const covers = groupCovers(posts);
  return (
    <Panel title="Today’s group parlays">
      {posts.length ? (
        <ul className="divide-y divide-gray-800">
          {posts.map((post) => {
            const { legs } = post.bets[0];
            const mine = legs.some((l) => l.addedBy?.id === profile?.id);
            const cover = covers.get(post.id)!;
            return (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onOpen(post.id)}
                  className={rowClass}
                >
                  <SeriesBadge
                    emoji={cover.emoji}
                    color={cover.color}
                    className="h-9 w-9 rounded-xl text-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {legs.length}-leg group parlay
                      <span className="font-normal text-gray-500">
                        {' · '}
                        {mine
                          ? 'You’re in'
                          : `by ${post.author.fullName.split(' ')[0]}`}
                      </span>
                    </span>
                    <GroupStatus post={post} now={now} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-gray-500">
          No group parlays today. Start one with the + button, then Group
          parlay.
        </p>
      )}
    </Panel>
  );
}

/** A live slip's state: busted or hit as soon as it's decided, else LIVE */
function LiveStatus({ post }: { post: FeedPost }) {
  const ladder = post.type === 'LADDER';
  const bet = post.bets[0];
  // Ladders count rungs; parlays count legs
  const parts = ladder ? post.bets : bet.legs;
  const hit = parts.filter((x) => x.result === 'WON').length;
  let tag = <LiveBadge />;
  if (!ladder && bet.result === 'LOST') {
    tag = <span className={`${chip} bg-red-400/15 text-red-400`}>BUSTED</span>;
  } else if (!ladder && bet.result === 'WON') {
    tag = (
      <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>
        HIT ✓
      </span>
    );
  }
  return (
    <span className="flex flex-none flex-col items-end gap-0.5">
      {tag}
      {parts.length > 1 && (
        <span className="text-[11px] text-gray-500 tabular-nums">
          {hit}/{parts.length} hit
        </span>
      )}
    </span>
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
                  color={post.author.avatarColor}
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
                <LiveStatus post={post} />
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
