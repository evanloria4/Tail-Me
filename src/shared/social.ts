import { z } from 'zod';

// Reactions, comments and tailers on a slip, shared by client and server

/**
 * The quick reactions: the picker's first page (six rows of seven, by mood),
 * and first on a slip in this order. Never drop one that's been used. Any standard emoji can be a reaction (the picker's other pages,
 * checked on the server against the Unicode list up to EMOJI_MAX_VERSION).
 * Stored as text, so no migration either way.
 */
// prettier-ignore
export const REACTION_EMOJIS = [
  // Hype
  '🔥', '🔒', '💰', '🐐', '💯', '🚀', '👑',
  // Cashing
  '❤️', '🙌', '👏', '🏆', '🤑', '💸', '💎',
  // Sweating it
  '🙏', '🤞', '🍀', '😬', '👀', '🫣', '🥵',
  // Ice cold, trends
  '🧊', '🥶', '🎯', '📈', '📉', '🚨', '🍿',
  // Meltdown
  '🤡', '💀', '🪦', '😭', '🤣', '🤯', '😵‍💫',
  // Sick of it
  '🤮', '🤢', '🥴', '😮‍💨', '😤', '😡', '🗑️',
] as const;

/** Any emoji; the server checks it's a real one */
export type ReactionEmoji = string;

/**
 * Newest Emoji version offered: 16.0 shows on iOS 18.4+ and current Android.
 * Newer ones would be empty boxes on most phones for a while.
 */
export const EMOJI_MAX_VERSION = 16;

/** Tooltip / screen reader name for each quick reaction */
export const REACTION_LABELS: Record<string, string> = {
  '🔥': 'Fire',
  '🔒': 'Lock',
  '💰': 'Money',
  '🐐': 'GOAT',
  '💯': '100',
  '🚀': 'To the moon',
  '👑': 'King',
  '❤️': 'Love it',
  '🙌': 'Yes!',
  '👏': 'Applause',
  '🏆': 'Winner',
  '🤑': 'Cashing',
  '💸': 'Money gone',
  '💎': 'Diamond hands',
  '🙏': 'Praying',
  '🤞': 'Fingers crossed',
  '🍀': 'Lucky',
  '😬': 'Sweating',
  '👀': 'Watching',
  '🫣': "Can't look",
  '🥵': 'Heater',
  '🧊': 'Ice cold',
  '🥶': 'Cold streak',
  '🎯': 'Dead on',
  '📈': 'Trending up',
  '📉': 'Trending down',
  '🚨': 'Alert',
  '🍿': 'Popcorn',
  '🤡': 'Clown',
  '💀': 'Dead',
  '🪦': 'RIP',
  '😭': 'Crying',
  '🤣': 'LMAO',
  '🤯': 'Mind blown',
  '😵‍💫': 'Dizzy',
  '🤮': 'Vomit',
  '🤢': 'Sick',
  '🥴': 'Woozy',
  '😮‍💨': 'Exhale',
  '😤': 'Fuming',
  '😡': 'Mad',
  '🗑️': 'Trash',
};

/** A reaction's name: the quick set's own, else the emoji itself */
export const reactionLabel = (emoji: string) => REACTION_LABELS[emoji] ?? emoji;

/**
 * How a slip lists its reactions: quick ones in their fixed order, then the
 * rest by count (most first), ties by emoji so the order is stable
 */
export function orderReactions<T extends { emoji: string; count: number }>(
  reactions: T[]
): T[] {
  const quick = REACTION_EMOJIS as readonly string[];
  const rank = (e: string) => {
    const i = quick.indexOf(e);
    return i === -1 ? quick.length : i;
  };
  return [...reactions].sort(
    (a, b) =>
      rank(a.emoji) - rank(b.emoji) ||
      b.count - a.count ||
      a.emoji.localeCompare(b.emoji)
  );
}

export type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  /** Whether the viewer has reacted with it */
  mine: boolean;
};

export const COMMENT_MAX = 500;

export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Say something')
    .max(COMMENT_MAX, `Comments are ${COMMENT_MAX} characters max`),
});

export const voteSchema = z.object({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export type Vote = -1 | 0 | 1;

export type PersonRef = {
  id: string;
  username: string;
  fullName: string;
  /** Profile photo (Supabase Storage public URL), or null for the initial */
  avatarUrl: string | null;
  /** Monogram background when there's no photo (a SERIES_COLORS key) */
  avatarColor: string;
};

export type FeedComment = {
  id: string;
  body: string;
  createdAt: string;
  author: PersonRef;
  likes: number;
  dislikes: number;
  myVote: Vote;
};

export type Tailer = PersonRef & { tailedAt: string };
