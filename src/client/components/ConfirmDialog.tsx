import React, { useCallback, useEffect, useRef, useState } from 'react';

// Our own "are you sure?" popup, in place of the browser's confirm() box.
//   const [confirm, confirmDialog] = useConfirm();
//   if (await confirm({ title: 'Delete this slip?', confirmLabel: 'Delete' })) ...
//   ...and render {confirmDialog} somewhere in the component.

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions */
  danger?: boolean;
};

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  onDone,
}: ConfirmOptions & { onDone: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    // A modal dialog opens in the top layer, so it also sits above the composer
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    // Backdrop clicks are a mouse shortcut; keyboard users have Escape (onCancel)
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-label={title}
      // Escape cancels
      onCancel={(e) => {
        e.preventDefault();
        // Don't let Escape also reach the composer behind this popup
        e.stopPropagation();
        onDone(false);
      }}
      // Clicking the dimmed backdrop (the dialog element itself) cancels
      onClick={(e) => e.target === ref.current && onDone(false)}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-gray-800 bg-gray-900 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {message && <p className="mt-1.5 text-sm text-gray-400">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            // Safe choice gets focus, so Enter doesn't destroy anything
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={() => onDone(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onDone(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              danger
                ? 'bg-red-500 text-[#fff] hover:bg-red-600'
                : 'bg-emerald-500 text-gray-950 hover:bg-emerald-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function useConfirm() {
  const [request, setRequest] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve });
      }),
    []
  );

  const element = request ? (
    <ConfirmDialog
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...request}
      onDone={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  ) : null;

  return [confirm, element] as const;
}
