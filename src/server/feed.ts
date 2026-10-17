import { Prisma } from '../generated/prisma/client';
import prisma from './db';
import { FeedPost, MarketKey } from '../shared/posts';
import { REACTION_EMOJIS, ReactionSummary } from '../shared/social';
import { currentStreak, Streak } from '../shared/stats';

/** Feed shape; `tails` only loads the viewer's own tail so we can show "Tailed" */
export const feedInclude = (viewerId: string) =>
  ({
    author: {
      select: { id: true, username: true, fullName: true, avatarUrl: true },
    },
    sportsbook: { select: { key: true, name: true } },
    bets: {
      orderBy: { order: 'asc' },
      include: {
        legs: { orderBy: { order: 'asc' } },
        _count: { select: { tails: true } },
        tails: { where: { userId: viewerId }, select: { id: true } },
      },
    },
    reactions: { select: { emoji: true, userId: true } },
    _count: { select: { comments: { where: { deletedAt: null } } } },
  }) satisfies Prisma.PostInclude;

type PostWithFeed = Prisma.PostGetPayload<{
  include: ReturnType<typeof feedInclude>;
}>;

/** Each author's current all-time streak, from their settled bets */
async function streaksFor(
  authorIds: string[]
): Promise<Map<string, Streak | null>> {
  const ids = [...new Set(authorIds)];
  if (!ids.length) return new Map();
  const bets = await prisma.bet.findMany({
    where: {
      post: { authorId: { in: ids }, deletedAt: null },
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
  return REACTION_EMOJIS.map((emoji) => {
    const mine = reactions.filter((r) => r.emoji === emoji);
    return {
      emoji,
      count: mine.length,
      mine: mine.some((r) => r.userId === viewerId),
    };
  }).filter((r) => r.count > 0);
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
    bets: post.bets.map((bet) => ({
      id: bet.id,
      order: bet.order,
      units: bet.units.toNumber(),
      americanOdds: bet.americanOdds,
      decimalOdds: bet.decimalOdds.toNumber(),
      result: bet.result,
      deepLink: bet.deepLink,
      tailCount: bet._count.tails,
      tailedByMe: bet.tails.length > 0,
      legs: bet.legs.map((leg) => ({
        id: leg.id,
        sportKey: leg.sportKey,
        eventLabel: leg.eventLabel,
        marketKey: leg.marketKey as MarketKey,
        marketLabel: leg.marketLabel,
        playerName: leg.playerName,
        selection: leg.selection,
        line: leg.line?.toNumber() ?? null,
        americanOdds: leg.americanOdds,
        deepLink: leg.deepLink,
      })),
    })),
  };
}

/** API shape for a page of posts loaded with `feedInclude(viewerId)` */
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
    include: feedInclude(viewerId),
  });
  if (!post) return null;
  const [feedPost] = await toFeedPosts([post], viewerId);
  return feedPost;
}
