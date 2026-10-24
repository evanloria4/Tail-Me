import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import {
  currentSubscription,
  enablePush,
  isStandalone,
  PushDenied,
  pushSupport,
} from '../lib/push';
import type { NotificationSettings } from '../lib/push';
import { useToast } from './Toast';

// The first time someone opens the home-screen app, offer notifications in
// one tap. iPhones only let a tap ask for permission, hence the popup rather
// than asking on load. Shown once per device; Settings → Notifications has
// the same switch afterwards.

const ASKED_KEY = 'tailme-push-asked';

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Private mode: it may ask again next time, which is harmless
  }
}

/** `ready`: nothing else is up (the first-visit tour goes first) */
export default function NotificationPrompt({ ready }: { ready: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      !ready ||
      !isStandalone() ||
      pushSupport() !== 'supported' ||
      Notification.permission !== 'default' ||
      alreadyAsked()
    ) {
      return undefined;
    }
    let live = true;
    (async () => {
      if (await currentSubscription()) return;
      const { data } = await api.get<NotificationSettings>('/me/notifications');
      if (live && data.publicKey) setPublicKey(data.publicKey);
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [ready]);

  const open = ready && !!publicKey;
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const close = () => {
    markAsked();
    setPublicKey(null);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      await enablePush(publicKey!);
      toast('Notifications on');
    } catch (err) {
      toast(
        err instanceof PushDenied
          ? 'No problem. You can turn them on later in Settings'
          : 'Could not turn them on. Try again in Settings'
      );
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-label="Turn on notifications"
      // Escape counts as "Not now"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-auto w-[min(24rem,calc(100%-2rem))] rounded-2xl border border-gray-800 bg-gray-900 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 text-center">
        <div className="text-4xl" aria-hidden="true">
          🔔
        </div>
        <h2 className="mt-3 text-lg font-bold">Turn on notifications?</h2>
        <p className="mt-1.5 text-sm text-gray-400">
          Know when friends post slips, tail yours, start a group parlay, and
          when your bets hit. Pick which ones anytime in Settings.
        </p>
        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Turning on…' : 'Turn on'}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
