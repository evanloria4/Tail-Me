import { z } from 'zod';

// Reactions, comments and tailers on a slip, shared by client and server

/**
 * The fixed reaction set; the order is how they show on a slip and in the
 * picker (5 per row: love it, sweating it, clowning it). Stored as text, so
 * adding one needs no migration; never drop one that's been used.
 */
// prettier-ignore
export const REACTION_EMOJIS = [
  '🔥', '🔒', '💰', '🐐', '❤️',
  '🙏', '🍀', '😬', '👀', '🧊',
  '🤡', '💀', '😭', '🤣', '🗑️',
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Tooltip / screen reader name for each reaction */
export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  '🔥': 'Fire',
  '🔒': 'Lock',
  '💰': 'Money',
  '🐐': 'GOAT',
  '❤️': 'Love it',
  '🙏': 'Praying',
  '🍀': 'Lucky',
  '😬': 'Sweating',
  '👀': 'Watching',
  '🧊': 'Ice cold',
  '🤡': 'Clown',
  '💀': 'Dead',
  '😭': 'Crying',
  '🤣': 'LMAO',
  '🗑️': 'Trash',
};

export const isReactionEmoji = (v: unknown): v is ReactionEmoji =>
  typeof v === 'string' && (REACTION_EMOJIS as readonly string[]).includes(v);

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
