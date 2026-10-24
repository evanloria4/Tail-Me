import webpush from 'web-push';
import prisma from './db';
import { notifyPrefs, NotifyType, PushPayload } from '../shared/notifications';

// Web Push: the browser's push service (Apple, Google, Mozilla) delivers to
// the service worker (src/client/public/sw.js), which shows the notification.
// Keys: `npx web-push generate-vapid-keys`, into VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY. Without them nothing is sent and Settings says it's off.

const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';

export const pushEnabled = !!(publicKey && privateKey);

if (pushEnabled) {
  // Push services contact this if a sender misbehaves
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'https://www.tail-me.com',
    publicKey,
    privateKey
  );
}

export const vapidPublicKey = () => (pushEnabled ? publicKey : null);

/** Gone or never valid: the person turned it off or uninstalled the app */
const isDeadSubscription = (err: unknown) =>
  err instanceof webpush.WebPushError &&
  (err.statusCode === 404 || err.statusCode === 410);

/**
 * Push to these people's devices, skipping anyone who switched `type` off.
 * Never throws, so routes can fire it without awaiting.
 */
export async function notify(
  userIds: Iterable<string>,
  /** null: always sent (the Settings test) */
  type: NotifyType | null,
  payload: PushPayload
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!pushEnabled || !ids.length) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, pushSubscriptions: { some: {} } },
      select: { notifyPrefs: true, pushSubscriptions: true },
    });
    const body = JSON.stringify(payload);
    const subs = users
      .filter((u) => !type || notifyPrefs(u.notifyPrefs)[type])
      .flatMap((u) => u.pushSubscriptions);
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            // A day: a phone that's off past that doesn't need old news
            { TTL: 86400, urgency: 'normal' }
          );
        } catch (err) {
          if (isDeadSubscription(err)) {
            await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          } else {
            console.error('Push failed', (err as Error).message);
          }
        }
      })
    );
  } catch (err) {
    console.error('Push notify failed', err);
  }
}

/** Everyone but `exceptId` (one friend group, so "everyone" is small) */
export async function notifyEveryone(
  exceptId: string,
  type: NotifyType,
  payload: PushPayload
): Promise<void> {
  if (!pushEnabled) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { not: exceptId }, pushSubscriptions: { some: {} } },
      select: { id: true },
    });
    await notify(
      users.map((u) => u.id),
      type,
      payload
    );
  } catch (err) {
    console.error('Push notify failed', err);
  }
}
