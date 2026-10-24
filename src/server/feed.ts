import { Prisma } from '../generated/prisma/client';
import prisma from './db';
import { FeedPost, MarketKey } from '../shared/posts';
import { orderReactions, PersonRef, ReactionSummary } from '../shared/social';
import { currentStreak, POST_TYPES, Streak } from '../shared/stats';

/** Feed shape; `tails` loads who tailed, for the avatar stack and "Tailed" */
export const feedInclude = {
  author: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      avatarColor: true,
    },
  },
  sportsbook: { select: { key: true, name: true } },
  series: { select: { id: true, name: true, emoji: true, color: true } },
  bets: {
    orderBy: { order: 'asc' },
    include: {
      legs: {
        orderBy: { order: 'asc' },
        include: {
          addedBy: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
          // For LIVE tags: when the game starts, and whether it's final
          // Score + clock for live and finished games
          event: {
            select: {
              commenceTime: true,
              completed: true,
              homeScore: true,
              awayScore: true,
              statusDetail: true,
            },
          },
        },
      },
      // Friend-group sized, so every tail loads (for the avatar stack)
      tails: {
        orderBy: { createdAt: 'desc' },
        select: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              avatarColor: true,
            },
          },
        },
      },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
  fades: { select: { userId: true } },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} satisfies Prisma.PostInclude;

type PostWithFeed = Prisma.PostGetPayload<{
  include: typeof feedInclude;
}>;

/** Each author's current all-time streak, from their settled personal bets */
async function streaksFor(
  authorIds: string[]
): Promise<Map<string, Streak | null>> {
  const ids = [...new Set(authorIds)];
  if (!ids.length) return new Map();
  const bets = await prisma.bet.findMany({
    where: {
      post: {
        authorId: { in: ids },
        // Deleted slips still count toward streaks
        type: { in: POST_TYPES },
      },
      result: { in: ['WON', 'LOST', 'PUSH'] },
    },
    select: {
      order: true,
      result: true,
      post: { select: { authorId: true, createdAt: true } },
    },
  });
  return new Map(
    ids.map((id) => [
      id,
      currentStreak(
        bets
          .filter((b) => b.post.authorId === id)
          .map((b) => ({
            order: b.order,
            result: b.result,
            createdAt: b.post.createdAt,
          }))
      ),
    ])
  );
}

export function reactionSummary(
  reactions: { emoji: string; userId: string }[],
  viewerId: string
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  reactions.forEach((r) => {
    const row = byEmoji.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      mine: false,
    };
    row.count += 1;
    if (r.userId === viewerId) row.mine = true;
    byEmoji.set(r.emoji, row);
  });
  return orderReactions([...byEmoji.values()]);
}

/** Distinct tailers, most recent first (a ladder tail lands on every rung) */
function tailersOf(post: PostWithFeed): FeedPost['tailers'] {
  const people = new Map<string, PersonRef>();
  post.bets
    .flatMap((b) => b.tails)
    .forEach((t) => {
      if (!people.has(t.user.id)) people.set(t.user.id, t.user);
    });
  return { count: people.size, recent: [...people.values()].slice(0, 3) };
}

function toFeedPost(
  post: PostWithFeed,
  viewerId: string,
  streak: Streak | null
): FeedPost {
  return {
    id: post.id,
    type: post.type,
    caption: post.caption,
    createdAt: post.createdAt.toISOString(),
    author: { ...post.author, streak },
    sportsbook: post.sportsbook,
    reactions: reactionSummary(post.reactions, viewerId),
    commentCount: post._count.comments,
    tailers: tailersOf(post),
    fadeCount: post.fades.length,
    fadedByMe: post.fades.some((f) => f.userId === viewerId),
    series: post.series,
    group:
      post.type === 'GROUP_PARLAY' && post.lockAt
        ? {
            lockAt: post.lockAt.toISOString(),
            lockedAt: post.lockedAt?.toISOString() ?? null,
            // Every leg is from this game, so any leg gives its league
            game:
              post.groupEventId && post.groupEventLabel
                ? {
                    eventId: post.groupEventId,
                    eventLabel: post.groupEventLabel,
                    sportKey: post.bets[0]?.legs[0]?.sportKey ?? '',
                  }
                : null,
          }
        : null,
    bets: post.bets.map((bet) => ({
      id: bet.id,
      order: bet.order,
      units: bet.units.toNumber(),
      americanOdds: bet.americanOdds,
      decimalOdds: bet.decimalOdds.toNumber(),
      result: bet.result,
      deepLink: bet.deepLink,
      tailCount: bet.tails.length,
      tailedByMe: bet.tails.some((t) => t.user.id === viewerId),
      legs: bet.legs.map((leg) => ({
        id: leg.id,
        sportKey: leg.sportKey,
        eventId: leg.eventId,
        eventLabel: leg.eventLabel,
        startsAt: leg.event?.commenceTime.toISOString() ?? null,
        gameFinal:
          !!leg.event?.completed || leg.event?.statusDetail === 'Final',
        score:
          leg.event?.statusDetail &&
          leg.event.homeScore != null &&
          leg.event.awayScore != null
            ? {
                away: leg.event.awayScore,
                home: leg.event.homeScore,
                clock: leg.event.statusDetail,
              }
            : null,
        marketKey: leg.marketKey as MarketKey,
        marketLabel: leg.marketLabel,
        playerName: leg.playerName,
        selection: leg.selection,
        line: leg.line?.toNumber() ?? null,
        americanOdds: leg.americanOdds,
        deepLink: leg.deepLink,
        result: leg.result,
        actual: leg.actual?.toNumber() ?? null,
        addedBy: leg.addedBy,
      })),
    })),
  };
}

/** API shape for a page of posts loaded with `feedInclude` */
export async function toFeedPosts(
  posts: PostWithFeed[],
  viewerId: string
): Promise<FeedPost[]> {
  const streaks = await streaksFor(posts.map((p) => p.authorId));
  return posts.map((p) =>
    toFeedPost(p, viewerId, streaks.get(p.authorId) ?? null)
  );
}

/** One post in API shape, or null if it's gone */
export async function loadFeedPost(
  postId: string,
  viewerId: string
): Promise<FeedPost | null> {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    include: feedInclude,
  });
  if (!post) return null;
  const [feedPost] = await toFeedPosts([post], viewerId);
  return feedPost;
}
