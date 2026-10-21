import React from 'react';

/**
 * A person's profile photo, or the first letter of their name on the brand
 * tint when they haven't added one. `className` sets size and text size,
 * e.g. "h-10 w-10 text-base".
 */
export default function UserAvatar({
  name,
  url,
  className = 'h-10 w-10 text-base',
}: {
  name?: string | null;
  url?: string | null;
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
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full bg-emerald-500/20 font-bold uppercase text-emerald-400 ${className}`}
    >
      {name?.[0] ?? '?'}
    </span>
  );
}
