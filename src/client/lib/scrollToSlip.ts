// Jump to a slip card in the feed and flash a ring around it. PostCard renders
// each card with id={slipAnchor(post.id)}.

export const slipAnchor = (postId: string) => `slip-${postId}`;

const HIGHLIGHT = [
  'ring-2',
  'ring-emerald-500',
  'ring-offset-2',
  'ring-offset-gray-950',
];
const HIGHLIGHT_MS = 2000;

/** Scrolls to the slip if it's on the page; false if it isn't loaded */
export default function scrollToSlip(postId: string): boolean {
  const el = document.getElementById(slipAnchor(postId));
  if (!el) return false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  el.classList.add(...HIGHLIGHT);
  setTimeout(() => el.classList.remove(...HIGHLIGHT), HIGHLIGHT_MS);
  return true;
}
