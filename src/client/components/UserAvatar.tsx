import React from 'react';
import { colorClasses } from './ColorSwatches';

/**
 * A person's profile photo, or the first letter of their name on the color
 * they picked (green until they pick) when they haven't added one. `className` sets size and text size,
 * e.g. "h-10 w-10 text-base".
 */
export default function UserAvatar({
  name,
  url,
  color,
  className = 'h-10 w-10 text-base',
}: {
  name?: string | null;
  url?: string | null;
  /** Monogram background, a SERIES_COLORS key */
  color?: string | null;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`flex-none rounded-full bg-gray-800 object-cover ${className}`}
      />
    );
  }
  const { tile, text } = colorClasses(color);
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold uppercase ${tile} ${text} ${className}`}
    >
      {name?.[0] ?? '?'}
    </span>
  );
}
