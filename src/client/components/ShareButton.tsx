import React from 'react';
import { slipUrl } from '../../shared/notifications';
import { useToast } from './Toast';

// Share a slip by link: the phone's share sheet where there is one (texts,
// group chats), else copy to the clipboard. The link opens the feed scrolled
// to the slip (/?slip=<id>, same as notifications); signed-out friends log
// in first and land on it after.
//
// NOT IN USE: shelved until there's a native App Store app. iOS opens links
// in Safari, never the home-screen web app (only native apps get Universal
// Links), so a shared link would drop iPhone friends in Safari. It was on
// group parlay cards beside the ⋯ menu, shown at any stage.

export default function ShareButton({
  postId,
  text,
}: {
  postId: string;
  /** The message that goes with the link */
  text: string;
}) {
  const toast = useToast();

  const share = async () => {
    const url = `${window.location.origin}${slipUrl(postId)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tail-Me', text, url });
        return;
      } catch (err) {
        // They closed the share sheet: nothing to do
        if ((err as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Copy this link', url);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share link"
      title="Share link"
      className="flex-none rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-800 hover:text-white"
    >
      <svg
        viewBox="0 0 20 20"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13V3M6.5 6.5 10 3l3.5 3.5" />
        <path d="M5 10v6.5h10V10" />
      </svg>
    </button>
  );
}
