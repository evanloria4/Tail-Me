import React, { useEffect, useId, useRef, useState } from 'react';
import ColorSwatches from './ColorSwatches';
import UserAvatar from './UserAvatar';

// Photo chooser: shows the current photo (or initial), with buttons to pick a
// new one or remove it. Without a photo, swatches pick the monogram's color. The parent decides what "save" means: Settings uploads
// right away, signup holds the file until the account exists.

export default function AvatarPicker({
  name,
  url,
  color,
  onColor,
  busy = false,
  onPick,
  onRemove,
}: {
  name?: string | null;
  /** The saved photo, shown until a new one is picked */
  url?: string | null;
  /** Monogram background (a SERIES_COLORS key) */
  color?: string | null;
  /** Omit to hide the color swatches */
  onColor?: (color: string) => void;
  busy?: boolean;
  onPick: (file: File) => void;
  /** Omit to hide the Remove button */
  onRemove?: () => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Free the preview's object URL when it changes or we unmount
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const shown = preview ?? url ?? null;
  let label = 'Add a photo';
  if (busy) label = 'Saving…';
  else if (shown) label = 'Change photo';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <UserAvatar
          name={name}
          url={shown}
          color={color}
          className="h-16 w-16 text-2xl"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className={`inline-flex cursor-pointer items-center rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-800 hover:text-white ${
              busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {label}
          </label>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Let the same file be picked again later
              e.target.value = '';
              if (!file) return;
              setPreview(URL.createObjectURL(file));
              onPick(file);
            }}
          />
          {onRemove && shown && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                onRemove();
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:text-red-400 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {onColor && !shown && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-gray-400">
            Or pick a color for your initial
          </span>
          <ColorSwatches
            label="Monogram color"
            value={color ?? 'emerald'}
            onChange={onColor}
          />
        </div>
      )}
    </div>
  );
}
