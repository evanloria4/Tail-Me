import prisma from './db';
import { notify, notifyEveryone, pushEnabled } from './push';
import {
  firstNameOf,
  GROUP_REMINDER_MINUTES,
  groupResultTitle,
  NoticeLeg,
  resultTitle,
  slipLine,
  newSlipTitle,
  slipUrl,
  tailedResultTitle,
  unitsLabel,
  yourSlip,
} from '../shared/notifications';
import { describeLeg } from '../shared/posts';
import { betNet } from '../shared/stats';
import { formatAmerican } from '../shared/odds';
import { inSiteZone, SITE_ZONE_LABEL } from '../shared/time';

// What happened -> who hears about it. Each one looks up what it needs and
// hands it to push.ts; callers fire these without awaiting (they never throw).

const legSelect = {
  marketKey: true,
  selection: true,
  line: true,
  playerName: true,
  marketLabel: true,
} as const;

const toNoticeLeg = (l: {
  marketKey: string;
  selection: string;
  line: { toNumber(): number } | null;
  playerName: string | null;
  marketLabel: string | null;
}): NoticeLeg => ({
  ...l,
  marketKey: l.marketKey as NoticeLeg['marketKey'],
  line: l.line?.toNumber() ?? null,
});

/** Swallow lookup errors too, so a failed notice never fails a request */
const safely =
  <A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>) =>
  async (...args: A): Promise<void> => {
    if (!pushEnabled) return;
    try {
      await fn(...args);
    } catch (err) {
      console.error(`Notice ${name} failed`, err);
    }
  };

const lockTime = (d: Date) =>
  `${d.toLocaleString(
    'en-US',
    inSiteZone({ weekday: 'short', hour: 'numeric', minute: '2-digit' })
  )} ${SITE_ZONE_LABEL}`;

/** A new slip goes to everyone else; group parlays ask for legs */
export const noticeNewPost = safely('new post', async (postId: string) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      type: true,
      caption: true,
      lockAt: true,
      groupEventLabel: true,
      author: { select: { id: true, fullName: true } },
      series: { select: { name: true } },
      bets: {
        orderBy: { order: 'asc' },
        select: {
          americanOdds: true,
          legs: { orderBy: { order: 'asc' }, select: legSelect },
        },
      },
    },
  });
  if (!post) return;
  const name = post.author.fullName;
  if (post.type === 'GROUP_PARLAY') {
    const game = post.groupEventLabel ? ` (${post.groupEventLabel} SGP)` : '';
    await notifyEveryone(post.author.id, 'groups', {
      title: `${name} started a group parlay${game}`,
      body: `Add your leg before ${lockTime(post.lockAt!)}`,
      url: slipUrl(post.id),
    });
    return;
  }
  const line = slipLine(
    post.type,
    post.bets.map((b) => ({ ...b, legs: b.legs.map(toNoticeLeg) }))
  );
  await notifyEveryone(post.author.id, 'slips', {
    title: newSlipTitle(name, post.type, post.series?.name),
    body: post.caption ? `${line}\n“${post.caption}”` : line,
    url: slipUrl(post.id),
  });
});

/** The poster hears who tailed or faded them */
export const noticeBacking = safely(
  'tail',
  async (postId: string, byId: string, kind: 'tail' | 'fade') => {
    const [post, by] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, type: true, authorId: true },
      }),
      prisma.user.findUnique({
        where: { id: byId },
        select: { fullName: true },
      }),
    ]);
    if (!post || !by || post.authorId === byId) return;
    await notify([post.authorId], 'tails', {
      title:
        kind === 'tail'
          ? `${by.fullName} tailed ${yourSlip(post.type)}`
          : `${by.fullName} faded ${yourSlip(post.type)}`,
      body: kind === 'tail' ? 'Riding with you 🤝' : 'Betting against you 👀',
      url: slipUrl(post.id),
    });
  }
);

/** Only the poster hears about a new comment */
export const noticeComment = safely(
  'comment',
  async (postId: string, byId: string, body: string) => {
    const [post, by] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, type: true, authorId: true },
      }),
      prisma.user.findUnique({
        where: { id: byId },
        select: { fullName: true },
      }),
    ]);
    if (!post || !by || post.authorId === byId) return;
    await notify([post.authorId], 'comments', {
      title: `${by.fullName} commented on ${yourSlip(post.type)}`,
      body,
      url: slipUrl(post.id),
    });
  }
);

export const noticeReaction = safely(
  'reaction',
  async (postId: string, byId: string, emoji: string) => {
    const [post, by] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, type: true, authorId: true },
      }),
      prisma.user.findUnique({
        where: { id: byId },
        select: { fullName: true },
      }),
    ]);
    if (!post || !by || post.authorId === byId) return;
    await notify([post.authorId], 'reactions', {
      title: `${by.fullName} reacted ${emoji} to ${yourSlip(post.type)}`,
      body: 'Tap to see it',
      url: slipUrl(post.id),
    });
  }
);

/** The creator hears who joined their group parlay, and with what */
export const noticeGroupJoin = safely(
  'group join',
  async (postId: string, byId: string) => {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        bets: {
          select: {
            americanOdds: true,
            legs: { select: { ...legSelect, addedById: true } },
          },
        },
      },
    });
    const bet = post?.bets[0];
    const leg = bet?.legs.find((l) => l.addedById === byId);
    const by = await prisma.user.findUnique({
      where: { id: byId },
      select: { fullName: true },
    });
    if (!post || !bet || !leg || !by || post.authorId === byId) return;
    await notify([post.authorId], 'groups', {
      title: `${by.fullName} joined your group parlay`,
      body: `${describeLeg(toNoticeLeg(leg))} · ${bet.legs.length} legs, ${formatAmerican(bet.americanOdds)}`,
      url: slipUrl(post.id),
    });
  }
);

/**
 * Slips that just settled: the poster and their tailers, or everyone in a
 * group parlay. Ladders wait for their last rung. `actorId` (whoever graded
 * by hand) doesn't hear about their own click.
 */
export const noticeSettled = safely(
  'settled',
  async (postIds: string[], actorId?: string) => {
    if (!postIds.length) return;
    const posts = await prisma.post.findMany({
      where: { id: { in: [...new Set(postIds)] }, deletedAt: null },
      select: {
        id: true,
        type: true,
        authorId: true,
        author: { select: { fullName: true } },
        bets: {
          orderBy: { order: 'asc' },
          select: {
            result: true,
            units: true,
            decimalOdds: true,
            americanOdds: true,
            legs: {
              orderBy: { order: 'asc' },
              select: { ...legSelect, addedById: true, result: true },
            },
            tails: { select: { userId: true } },
          },
        },
      },
    });
    await Promise.all(
      posts.map(async (post) => {
        if (post.bets.some((b) => b.result === 'PENDING')) return;
        const skip = (ids: Iterable<string>) =>
          [...ids].filter((id) => id !== actorId);
        const url = slipUrl(post.id);
        const line = slipLine(
          post.type,
          post.bets.map((b) => ({ ...b, legs: b.legs.map(toNoticeLeg) }))
        );

        if (post.type === 'GROUP_PARLAY') {
          const bet = post.bets[0];
          const people = new Set([
            post.authorId,
            ...bet.legs.flatMap((l) => (l.addedById ? [l.addedById] : [])),
          ]);
          await notify(skip(people), 'results', {
            title: groupResultTitle(bet.result, bet.americanOdds),
            body: line,
            url,
          });
          return;
        }

        const net = post.bets.reduce(
          (sum, b) =>
            sum +
            betNet({
              units: b.units.toNumber(),
              decimalOdds: b.decimalOdds.toNumber(),
              result: b.result,
            }),
          0
        );
        await notify(skip([post.authorId]), 'results', {
          title: resultTitle(post.type, post.bets, net),
          body: line,
          url,
        });
        const tailers = new Set(
          post.bets.flatMap((b) => b.tails.map((t) => t.userId))
        );
        tailers.delete(post.authorId);
        await notify(skip(tailers), 'results', {
          title: tailedResultTitle(
            firstNameOf(post.author.fullName),
            post.type,
            post.bets
          ),
          body: post.type === 'LADDER' ? `${line} · ${unitsLabel(net)}` : line,
          url,
        });
      })
    );
  }
);

/**
 * Open group parlays locking within GROUP_REMINDER_MINUTES: everyone without
 * a leg gets one nudge. Run from the grader loop.
 */
export const sendGroupReminders = safely(
  'group reminders',
  async (now: Date = new Date()) => {
    const soon = new Date(now.getTime() + GROUP_REMINDER_MINUTES * 60_000);
    const groups = await prisma.post.findMany({
      where: {
        type: 'GROUP_PARLAY',
        deletedAt: null,
        lockedAt: null,
        lockReminderAt: null,
        lockAt: { gt: now, lte: soon },
      },
      select: {
        id: true,
        lockAt: true,
        authorId: true,
        author: { select: { fullName: true } },
        bets: {
          select: { americanOdds: true, legs: { select: { addedById: true } } },
        },
      },
    });
    if (!groups.length) return;
    const everyone = await prisma.user.findMany({
      where: { pushSubscriptions: { some: {} } },
      select: { id: true },
    });
    // eslint-disable-next-line no-restricted-syntax
    for (const group of groups) {
      // Claimed first, so two overlapping runs can't both send it
      // eslint-disable-next-line no-await-in-loop
      const { count } = await prisma.post.updateMany({
        where: { id: group.id, lockReminderAt: null },
        data: { lockReminderAt: now },
      });
      if (!count) continue; // eslint-disable-line no-continue
      const bet = group.bets[0];
      const joined = new Set(
        bet.legs.flatMap((l) => (l.addedById ? [l.addedById] : []))
      );
      joined.add(group.authorId);
      const minutes = Math.max(
        1,
        Math.round((group.lockAt!.getTime() - now.getTime()) / 60_000)
      );
      // eslint-disable-next-line no-await-in-loop
      await notify(
        everyone.map((u) => u.id).filter((id) => !joined.has(id)),
        'groups',
        {
          title: `⏰ ${firstNameOf(group.author.fullName)}'s group parlay locks in ${minutes} min`,
          body: `${bet.legs.length} legs at ${formatAmerican(bet.americanOdds)} so far. Add yours.`,
          url: slipUrl(group.id),
        }
      );
    }
  }
);
