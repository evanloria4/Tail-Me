import React, { useEffect, useState } from 'react';
import {
  EMOJI_MAX_VERSION,
  REACTION_EMOJIS,
  reactionLabel,
} from '../../shared/social';

// The reaction picker: the quick set on page one, then every standard emoji
// in pages by category, like the iOS emoji keyboard. The full list (Unicode,
// via unicode-emoji-json) is its own bundle chunk, loaded the first time
// the picker opens.

type Page = {
  icon: string;
  title: string;
  emojis: { emoji: string; name: string }[];
};

/** Tab icon per Unicode group, in the keyboard's order */
const GROUP_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'People & Body': '👋',
  'Animals & Nature': '🐶',
  'Food & Drink': '🍔',
  Activities: '⚽',
  'Travel & Places': '🚗',
  Objects: '💡',
  Symbols: '🔣',
  Flags: '🏁',
};

const QUICK: Page = {
  icon: '⭐',
  title: 'Quick',
  emojis: REACTION_EMOJIS.map((emoji) => ({
    emoji,
    name: reactionLabel(emoji),
  })),
};

/** Loaded once per visit, shared by every picker on the page */
let groupsPromise: Promise<Page[]> | null = null;
function loadGroups(): Promise<Page[]> {
  groupsPromise ??= import(
    /* webpackChunkName: "emoji" */ 'unicode-emoji-json/data-by-group.json'
  ).then((mod) =>
    mod.default
      .filter((g) => GROUP_ICONS[g.name])
      .map((g) => ({
        icon: GROUP_ICONS[g.name],
        title: g.name,
        emojis: g.emojis
          .filter((e) => Number(e.emoji_version) <= EMOJI_MAX_VERSION)
          .map((e) => ({ emoji: e.emoji, name: e.name })),
      }))
  );
  return groupsPromise;
}

export default function EmojiPicker({
  onPick,
  isMine,
}: {
  onPick: (emoji: string) => void;
  /** Whether the viewer already reacted with it (highlighted; picking undoes it) */
  isMine: (emoji: string) => boolean;
}) {
  const [groups, setGroups] = useState<Page[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let live = true;
    loadGroups()
      .then((g) => live && setGroups(g))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const pages = [QUICK, ...(groups ?? [])];
  const page = pages[Math.min(index, pages.length - 1)];

  return (
    // 7 columns of 2.25rem + gaps + padding: about 280px, fits small phones
    <div className="w-[17.5rem] rounded-2xl border border-gray-800 bg-gray-900 shadow-xl">
      <div
        role="tablist"
        aria-label="Emoji categories"
        className="flex justify-between border-b border-gray-800 px-1.5 pt-1.5"
      >
        {[
          QUICK,
          ...Object.entries(GROUP_ICONS).map(([title, icon]) => ({
            title,
            icon,
          })),
        ].map((tab, i) => (
          <button
            key={tab.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={tab.title}
            title={tab.title}
            // Category pages wait for the list; Quick never does
            disabled={i > 0 && !groups}
            onClick={() => setIndex(i)}
            className={`-mb-px flex h-8 w-7 items-center justify-center border-b-2 text-base transition disabled:opacity-40 ${
              i === index
                ? 'border-emerald-500'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {page.title}
      </p>
      <div
        role="tabpanel"
        aria-label={page.title}
        className="grid h-60 grid-cols-7 content-start gap-0.5 overflow-y-auto px-2 pb-2"
      >
        {page.emojis.map(({ emoji, name }) => (
          <button
            key={emoji}
            type="button"
            aria-pressed={isMine(emoji)}
            aria-label={name}
            title={name}
            onClick={() => onPick(emoji)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-gray-800 ${
              isMine(emoji) ? 'bg-emerald-500/15' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
        {index > 0 && failed && (
          <p className="col-span-7 py-6 text-center text-sm text-gray-500">
            Couldn&apos;t load emoji. Try again in a moment.
          </p>
        )}
      </div>
    </div>
  );
}
