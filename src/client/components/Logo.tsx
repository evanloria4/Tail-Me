import React from 'react';
import { Link } from 'react-router-dom';

/**
 * The TailMe wordmark, linking home. Light mode sets the dark-mode wordmark
 * in a dark chip; the literal colors keep it identical in both themes.
 */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`rounded-lg bg-[#111827] px-3 pb-1.5 pt-1 text-2xl font-extrabold tracking-tight text-[#fff] sm:text-3xl dark:bg-transparent dark:p-0 ${className}`}
    >
      Tail<span className="text-[#34d399]">Me</span>
    </Link>
  );
}
