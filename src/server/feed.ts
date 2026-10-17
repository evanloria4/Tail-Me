import { Prisma } from '../generated/prisma/client';
import { FeedPost, MarketKey } from '../shared/posts';

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
  }) satisfies Prisma.PostInclude;

type PostWithFeed = Prisma.PostGetPayload<{
  include: ReturnType<typeof feedInclude>;
}>;

export function toFeedPost(post: PostWithFeed): FeedPost {
  return {
    id: post.id,
    type: post.type,
    caption: post.caption,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    sportsbook: post.sportsbook,
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
