import { useEffect, useState } from 'react';

/** Below the 4rem header, plus a gap */
const TOP = 96;
/** Space kept under a column taller than the screen */
const BOTTOM = 16;

/**
 * `top` for a sticky side column. A column that fits pins under the header;
 * a taller one scrolls with the page until its bottom is in view, then pins
 * there (like Twitter's sidebar), so it never needs its own scrollbar.
 */
export default function useStickyTop<T extends HTMLElement>() {
  // A callback ref, so a column that renders after loading still gets measured
  const [el, setEl] = useState<T | null>(null);
  const [top, setTop] = useState(TOP);

  useEffect(() => {
    if (!el) return undefined;
    const update = () =>
      setTop(Math.min(TOP, window.innerHeight - el.offsetHeight - BOTTOM));
    update();
    // Content loads in and panels change size, so watch the column itself
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [el]);

  return { ref: setEl, top };
}
