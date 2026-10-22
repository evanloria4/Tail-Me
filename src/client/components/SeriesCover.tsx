import React from 'react';
import {
  DEFAULT_SERIES_COLOR,
  SERIES_COLORS,
  SERIES_EMOJIS,
} from '../../shared/series';
import type { SeriesColor } from '../../shared/series';

// A series' cover: its emoji on its color, as a rounded tile. Owners pick both
// when they start or edit a series.

/** Tile background and picker swatch per color (literal for Tailwind) */
const COLOR_CLASSES: Record<SeriesColor, { tile: string; swatch: string }> = {
  emerald: { tile: 'bg-emerald-400/20', swatch: 'bg-emerald-400' },
  sky: { tile: 'bg-sky-400/20', swatch: 'bg-sky-400' },
  violet: { tile: 'bg-violet-400/20', swatch: 'bg-violet-400' },
  pink: { tile: 'bg-pink-400/20', swatch: 'bg-pink-400' },
  red: { tile: 'bg-red-400/20', swatch: 'bg-red-400' },
  orange: { tile: 'bg-orange-400/20', swatch: 'bg-orange-400' },
  yellow: { tile: 'bg-yellow-300/25', swatch: 'bg-yellow-300' },
  gray: { tile: 'bg-gray-700/60', swatch: 'bg-gray-500' },
};

const colorClasses = (color: string) =>
  COLOR_CLASSES[color as SeriesColor] ?? COLOR_CLASSES[DEFAULT_SERIES_COLOR];

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
      <div
        role="radiogroup"
        aria-label="Series color"
        className="flex flex-wrap gap-2"
      >
        {SERIES_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={c}
            title={c[0].toUpperCase() + c.slice(1)}
            onClick={() => onChange({ emoji, color: c })}
            className={`h-6 w-6 rounded-full ${COLOR_CLASSES[c].swatch} ring-offset-2 ring-offset-gray-900 transition ${
              c === color ? 'ring-2 ring-white' : 'hover:scale-110'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
