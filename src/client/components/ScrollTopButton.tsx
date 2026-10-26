import React, { useEffect, useState } from 'react';

/** Show the button once the page is scrolled past about a screen */
const SHOW_AFTER = 1.2;

/**
 * Back to the top: a small round button, bottom left (the new-bet button is
 * bottom right), that fades in once you've scrolled down a screen or so.
 */
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setShow(window.scrollY > window.innerHeight * SHOW_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-gray-800 bg-gray-900/95 text-gray-300 shadow-lg shadow-black/20 backdrop-blur transition hover:text-white active:scale-95 md:bottom-8 md:left-8 ${
        show
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 16V4M5 9l5-5 5 5" />
      </svg>
    </button>
  );
}
