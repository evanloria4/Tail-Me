import React from 'react';
import { SERIES_EMOJIS } from '../../shared/series';
import ColorSwatches, { colorClasses } from './ColorSwatches';

// A series' cover: its emoji on its color, as a rounded tile. Owners pick both
// when they start or edit a series.

export function SeriesBadge({
  emoji,
  color,
  className = 'h-7 w-7 rounded-lg text-base',
}: {
  emoji: string;
  color: string;
  /** Size, corner radius and emoji size */
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center ${colorClasses(color).tile} ${className}`}
    >
      {emoji}
    </span>
  );
}

export function SeriesCoverPicker({
  emoji,
  color,
  onChange,
}: {
  emoji: string;
  color: string;
  onChange: (cover: { emoji: string; color: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label="Series emoji"
        className="grid grid-cols-6 gap-1"
      >
        {SERIES_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={e === emoji}
            onClick={() => onChange({ emoji: e, color })}
            className={`flex aspect-square items-center justify-center rounded-lg text-lg transition hover:bg-gray-800 ${
              e === emoji
                ? `${colorClasses(color).tile} ring-2 ring-emerald-500`
                : ''
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <ColorSwatches
        label="Series color"
        value={color}
        onChange={(c) => onChange({ emoji, color: c })}
      />
    </div>
  );
}
