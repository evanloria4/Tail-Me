import { useEffect, useRef, useState } from 'react';
import { isStandalone } from './push';

/** How far to pull (px, after resistance) before letting go refreshes */
export const PULL_THRESHOLD = 70;
/** The indicator never travels further than this */
const MAX_PULL = 110;
/** Keep the spinner up at least this long so a refresh reads as one */
const MIN_SPIN_MS = 700;

/**
 * Pull down at the top of the page to refresh, for the home-screen app,
 * which has no browser pull-to-refresh of its own. Off in browser tabs
 * (Safari / Chrome already do it, and two would fight). Returns how far the
 * page is pulled (for the indicator) and whether a refresh is running.
 */
export default function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Latest callback and state without re-binding the touch listeners
  const latest = useRef({ onRefresh, refreshing });
  latest.current = { onRefresh, refreshing };

  useEffect(() => {
    if (!isStandalone()) return undefined;
    let startY: number | null = null;
    let distance = 0;

    const onStart = (e: TouchEvent) => {
      // Only from the very top, and not while a dialog (composer) is open
      if (window.scrollY > 0 || latest.current.refreshing) return;
      if (document.querySelector('dialog[open]')) return;
      startY = e.touches[0].clientY;
      distance = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        startY = null;
        setPull(0);
        return;
      }
      // Resistance: the further you pull, the less it moves
      distance = Math.min(MAX_PULL, dy * 0.5);
      setPull(distance);
      // Hold the page still while pulling instead of rubber-banding
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (distance < PULL_THRESHOLD) {
        setPull(0);
        return;
      }
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      const started = Date.now();
      try {
        await latest.current.onRefresh();
      } finally {
        const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, wait);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: it has to stop the page bouncing while pulling
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  return { pull, refreshing };
}
