import React from 'react';
import type { SettledResult, StatRange } from '../../shared/stats';

// Pieces shared by profiles and the Records page: the date range tabs and
// the row of recent results.

const RANGE_TABS: Record<StatRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  all: 'All time',
};

export function RangeTabs({
  value,
  onChange,
}: {
  value: StatRange;
  onChange: (r: StatRange) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className="inline-flex rounded-lg border border-gray-800 bg-gray-900 p-0.5"
    >
      {(Object.keys(RANGE_TABS) as StatRange[]).map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            value === r
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {RANGE_TABS[r]}
        </button>
      ))}
    </div>
  );
}

const FORM_STYLES: Record<SettledResult, string> = {
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  PUSH: 'bg-yellow-500/15 text-yellow-300',
};

const FORM_SIZES = {
  md: 'h-6 w-6 text-[11px]',
  sm: 'h-5 w-5 text-[10px]',
};

/** W / L / P squares, newest first */
export function FormDots({
  results,
  size = 'md',
}: {
  results: SettledResult[];
  size?: keyof typeof FORM_SIZES;
}) {
  return (
    <ol className="flex gap-1" aria-label={results.join(', ')}>
      {results.map((r, i) => (
        <li
          // Results have no id; position is the identity here
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          title={r}
          className={`flex items-center justify-center rounded font-bold ${FORM_SIZES[size]} ${FORM_STYLES[r]}`}
        >
          {r[0]}
        </li>
      ))}
    </ol>
  );
}
