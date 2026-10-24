import api from './api';
import type { NotifyPrefs } from '../../shared/notifications';

// Push notifications on this device: the service worker (public/sw.js) shows
// them; here we register it, subscribe with the server's key, and route taps.
// iPhones only allow push in the installed app (Add to Home Screen, iOS 16.4+).

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

export type NotificationSettings = {
  /** null when the server has no VAPID keys */
  publicKey: string | null;
  prefs: NotifyPrefs;
};

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS asks for the desktop site and says it's a Mac
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Opened from the home screen rather than a browser tab */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  ) {
    return 'supported';
  }
  // Safari on iPhone hides the push APIs until the site is installed
  if (isIOS() && !isStandalone()) return 'needs-install';
  return 'unsupported';
}

/** Chrome / Android's install prompt, held until someone taps Install */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let installPrompt: InstallPrompt | null = null;

/** Whether this browser offered to install the app (Chrome / Android) */
export const canPromptInstall = () => !!installPrompt;

/** Shows the browser's install dialog; true if they installed it */
export async function promptInstall(): Promise<boolean> {
  const prompt = installPrompt;
  if (!prompt) return false;
  installPrompt = null; // single use
  await prompt.prompt();
  return (await prompt.userChoice).outcome === 'accepted';
}

/** Once at startup; the app works the same if it fails */
export function registerServiceWorker() {
  // Fires early, so it's caught here rather than on the Settings page
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
  });
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

/** A tapped notification while the app is open: route there in place */
export function onNotificationOpen(open: (path: string) => void) {
  if (!('serviceWorker' in navigator)) return () => {};
  const listener = (event: MessageEvent) => {
    if (event.data?.type !== 'open') return;
    const url = new URL(event.data.url, window.location.origin);
    if (url.origin === window.location.origin) {
      open(url.pathname + url.search);
    }
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}

/** VAPID keys come base64url-encoded; subscribe() wants the raw bytes */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** This device's subscription, if it has one */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'supported') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export class PushDenied extends Error {}

/**
 * Ask for permission (must run from a tap) and subscribe this device. Throws
 * PushDenied when the person or browser says no.
 */
export async function enablePush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushDenied();
  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key (keys were rotated) can't be used
  const wanted = keyBytes(publicKey);
  const existing = sub?.options.applicationServerKey;
  if (sub && existing && new Uint8Array(existing).join() !== wanted.join()) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: wanted,
  });
  await api.post('/me/push', sub.toJSON());
}

/** Stop notifications on this device (other devices keep theirs) */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.delete('/me/push', { data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}
