import { z } from 'zod';
import { formatAmerican } from './odds';
import { describeLeg } from './posts';
import type { FeedLeg } from './posts';

// Push notifications: what kinds there are, who gets them by default, and
// how each one reads. Sending lives in server/push.ts.

export const NOTIFY_TYPES = [
  'slips',
  'groups',
  'tails',
  'comments',
  'reactions',
  'results',
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];
export type NotifyPrefs = Record<NotifyType, boolean>;

/** Settings → Notifications rows, in this order */
export const NOTIFY_LABELS: Record<
  NotifyType,
  { label: string; hint: string }
> = {
  slips: { label: 'New slips', hint: 'A friend posts a slip' },
  groups: {
    label: 'Group parlays',
    hint: 'One starts, someone joins yours, or one locks within the hour without your leg',
  },
  tails: { label: 'Tails and fades', hint: 'Someone tails or fades your slip' },
  comments: {
    label: 'Comments',
    hint: 'Someone comments on your slip',
  },
  reactions: { label: 'Reactions', hint: 'Someone reacts to your slip' },
  results: {
    label: 'Results',
    hint: 'Your slips, slips you tailed and your group parlays settle',
  },
};

/** Reactions are chatty, so they start off */
export const NOTIFY_DEFAULTS: NotifyPrefs = {
  slips: true,
  groups: true,
  tails: true,
  comments: true,
  reactions: false,
  results: true,
};

/** Stored prefs only hold what someone changed; the rest are defaults */
export function notifyPrefs(stored: unknown): NotifyPrefs {
  const prefs = { ...NOTIFY_DEFAULTS };
  if (stored && typeof stored === 'object') {
    NOTIFY_TYPES.forEach((t) => {
      const v = (stored as Record<string, unknown>)[t];
      if (typeof v === 'boolean') prefs[t] = v;
    });
  }
  return prefs;
}

export const notifyPrefsSchema = z
  .object(
    Object.fromEntries(
      NOTIFY_TYPES.map((t) => [t, z.boolean().optional()])
    ) as Record<NotifyType, z.ZodOptional<z.ZodBoolean>>
  )
  .strict();

/** A browser's PushSubscription.toJSON(), as the client sends it */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

/** What the service worker shows; `url` opens on tap, `tag` replaces an older one */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

/** Minutes before a group parlay locks that people without a leg get nudged */
export const GROUP_REMINDER_MINUTES = 60;

/** Opens the feed scrolled to that slip */
export const slipUrl = (postId: string) => `/?slip=${postId}`;

type SlipKind = 'STRAIGHT' | 'PARLAY' | 'LADDER' | 'GROUP_PARLAY';

const KIND_NAMES: Record<SlipKind, string> = {
  STRAIGHT: 'straight',
  PARLAY: 'parlay',
  LADDER: 'ladder',
  GROUP_PARLAY: 'group parlay',
};

/** "a parlay", "a straight", "a group parlay" */
export const slipNoun = (type: SlipKind) => `a ${KIND_NAMES[type]}`;
/** "Charlie posted a parlay", or the series it's filed under: "Charlie posted the CharLadder" */
export const newSlipTitle = (
  name: string,
  type: SlipKind,
  seriesName?: string | null
) => `${name} posted ${seriesName ? `the ${seriesName}` : slipNoun(type)}`;

/** "your parlay" */
export const yourSlip = (type: SlipKind) => `your ${KIND_NAMES[type]}`;

export type NoticeLeg = Pick<
  FeedLeg,
  'marketKey' | 'selection' | 'line' | 'playerName' | 'marketLabel'
>;

/** One line for a slip's picks: "Chiefs -3.5 (-110)", "3-leg parlay +596" */
export function slipLine(
  type: SlipKind,
  bets: { americanOdds: number; legs: NoticeLeg[] }[]
): string {
  const first = bets[0];
  if (!first?.legs.length) return '';
  const pick = describeLeg(first.legs[0]);
  if (type === 'LADDER') return `${pick} ladder, ${bets.length} rungs`;
  if (first.legs.length === 1) {
    return `${pick} (${formatAmerican(first.americanOdds)})`;
  }
  return `${first.legs.length}-leg parlay ${formatAmerican(first.americanOdds)}: ${first.legs
    .map(describeLeg)
    .join(', ')}`;
}

/** "+2.4u" / "-1u" */
export function unitsLabel(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}u`;
}

/** What settling looks like from the poster's side */
export function resultTitle(
  type: SlipKind,
  bets: { result: string }[],
  net: number
): string {
  if (type === 'LADDER') {
    const hit = bets.filter((b) => b.result === 'WON').length;
    const graded = bets.filter((b) => b.result !== 'VOID').length;
    return `Your ladder finished ${hit}/${graded} · ${unitsLabel(net)}`;
  }
  const yours = `Your ${KIND_NAMES[type]}`;
  const { result } = bets[0];
  if (result === 'WON') return `✅ ${yours} hit! ${unitsLabel(net)}`;
  if (result === 'LOST') return `❌ ${yours} lost · ${unitsLabel(net)}`;
  if (result === 'PUSH') return `${yours} pushed`;
  return `${yours} was voided`;
}

/** The same for someone who tailed it */
export function tailedResultTitle(
  posterName: string,
  type: SlipKind,
  bets: { result: string }[]
): string {
  const whose = `${posterName}'s ${KIND_NAMES[type]}`;
  if (type === 'LADDER') {
    const hit = bets.filter((b) => b.result === 'WON').length;
    const graded = bets.filter((b) => b.result !== 'VOID').length;
    return `${whose} you tailed finished ${hit}/${graded}`;
  }
  const { result } = bets[0];
  if (result === 'WON') return `✅ ${whose} you tailed hit!`;
  if (result === 'LOST') return `❌ ${whose} you tailed lost`;
  if (result === 'PUSH') return `${whose} you tailed pushed`;
  return `${whose} you tailed was voided`;
}

/** Everyone in a group parlay hears the same thing */
export function groupResultTitle(result: string, americanOdds: number): string {
  if (result === 'WON') {
    return `🎉 The group parlay hit at ${formatAmerican(americanOdds)}!`;
  }
  if (result === 'LOST') return '💀 The group parlay busted';
  if (result === 'PUSH') return 'The group parlay pushed';
  return 'The group parlay was voided';
}

/** First name for short titles */
export const firstNameOf = (fullName: string) =>
  fullName.trim().split(/\s+/)[0] || fullName;
