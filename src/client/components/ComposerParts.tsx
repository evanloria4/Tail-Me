import React from 'react';

// Pieces shared by the bet picker and the group parlay review

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

/** The popup's title row */
export function ComposerHeader({
  title = 'New slip',
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );
}
