import { useEffect, useRef } from 'react';

/** The grader's pace: ESPN scores and grades land every couple of minutes */
export const LIVE_REFRESH_MS = 2 * 60_000;

/**
 * Calls `refresh` every `ms` while the tab is visible, and right away when
 * the viewer comes back to it. Callers swap fresh data in place (no loading
 * state), so the page doesn't jump or lose its scroll.
 */
export default function useAutoRefresh(
  refresh: () => void,
  ms = LIVE_REFRESH_MS
) {
  // Latest callback without restarting the timer on every render
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) latest.current();
    };
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ms]);
}
