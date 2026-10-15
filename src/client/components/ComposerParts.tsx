import React from 'react';
import {
  decimalToAmerican,
  formatAmerican,
  formatMoney,
  payout,
} from '../../shared/odds';

// Pieces shared by the live-odds picker and the manual slip form

export const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-emerald-500';

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="-mr-2 rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** Odds + "$10 pays" for the footer; null until there's a price to show */
export function PaysSummary({ decimals }: { decimals: (number | null)[] }) {
  const priced = decimals.filter((d): d is number => d !== null);
  if (!priced.length) {
    return <span className="text-gray-500">Enter odds to see the payout</span>;
  }
  if (decimals.length === 1) {
    return (
      <span className="text-gray-300">
        <span className="font-mono">
          {formatAmerican(decimalToAmerican(priced[0]))}
        </span>
        {' · $10 pays '}
        <span className="font-semibold text-emerald-400">
          {formatMoney(payout(10, priced[0]))}
        </span>
      </span>
    );
  }
  const low = Math.min(...priced);
  const high = Math.max(...priced);
  return (
    <span className="text-gray-300">
      {'$10 pays '}
      <span className="font-semibold text-emerald-400">
        {formatMoney(payout(10, low))}
        {high !== low && `–${formatMoney(payout(10, high))}`}
      </span>
    </span>
  );
}

/** The popup's title row */
export function ComposerHeader({
  onClose,
  children,
}: {
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
      <h2 className="text-lg font-bold">New slip</h2>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );
}
