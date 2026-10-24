import groups from 'unicode-emoji-json/data-by-group.json';
import { EMOJI_MAX_VERSION, REACTION_EMOJIS } from '../shared/social';

// Every emoji a reaction may be: the Unicode list up to EMOJI_MAX_VERSION
// (base emoji, no skin tone variants), plus the quick set. Server only: the
// list is big, so the browser loads its own copy only when the picker opens.

const ALLOWED = new Set<string>([
  ...REACTION_EMOJIS,
  ...groups.flatMap((g) =>
    g.emojis
      .filter((e) => Number(e.emoji_version) <= EMOJI_MAX_VERSION)
      .map((e) => e.emoji)
  ),
]);

export default function isReactionEmoji(v: unknown): v is string {
  return typeof v === 'string' && ALLOWED.has(v);
}
