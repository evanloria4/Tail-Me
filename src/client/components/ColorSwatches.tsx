import React from 'react';
import { DEFAULT_SERIES_COLOR, SERIES_COLORS } from '../../shared/series';
import type { SeriesColor } from '../../shared/series';

// The one color palette for things people personalize: series covers and
// profile monograms. Classes are literal so Tailwind keeps them.

/** Tile background, monogram letter and picker swatch per color */
const COLOR_CLASSES: Record<
  SeriesColor,
  { tile: string; text: string; swatch: string }
> = {
  emerald: {
    tile: 'bg-emerald-400/20',
    text: 'text-emerald-400',
    swatch: 'bg-emerald-400',
  },
  sky: {
    tile: 'bg-sky-400/20',
    text: 'text-sky-700 dark:text-sky-400',
    swatch: 'bg-sky-400',
  },
  violet: {
    tile: 'bg-violet-400/20',
    text: 'text-violet-400',
    swatch: 'bg-violet-400',
  },
  pink: {
    tile: 'bg-pink-400/20',
    text: 'text-pink-400',
    swatch: 'bg-pink-400',
  },
  red: { tile: 'bg-red-400/20', text: 'text-red-400', swatch: 'bg-red-400' },
  orange: {
    tile: 'bg-orange-400/20',
    text: 'text-orange-400',
    swatch: 'bg-orange-400',
  },
  yellow: {
    tile: 'bg-yellow-300/25',
    text: 'text-yellow-300',
    swatch: 'bg-yellow-300',
  },
  gray: {
    tile: 'bg-gray-700/60',
    text: 'text-gray-300',
    swatch: 'bg-gray-500',
  },
};

/** Classes for a stored color; unknown values fall back to the default */
export const colorClasses = (color: string | null | undefined) =>
  COLOR_CLASSES[color as SeriesColor] ?? COLOR_CLASSES[DEFAULT_SERIES_COLOR];

export default function ColorSwatches({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: SeriesColor) => void;
  /** Names the group for screen readers, e.g. "Series color" */
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {SERIES_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={c}
          title={c[0].toUpperCase() + c.slice(1)}
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full ${COLOR_CLASSES[c].swatch} ring-offset-2 ring-offset-gray-900 transition ${
            c === value ? 'ring-2 ring-white' : 'hover:scale-110'
          }`}
        />
      ))}
    </div>
  );
}
