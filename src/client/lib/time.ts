import { inSiteZone, SITE_ZONE_LABEL, siteDayDiff } from '../../shared/time';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago", "yesterday", or a date after a week */
export default function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Math.abs(seconds) > 7 * 86400) {
    return new Date(iso).toLocaleDateString(
      'en-US',
      inSiteZone({ month: 'short', day: 'numeric' })
    );
  }
  const match = UNITS.find(([, secs]) => Math.abs(seconds) >= secs);
  return match
    ? rtf.format(Math.round(seconds / match[1]), match[0])
    : 'just now';
}

/**
 * When something happens, in Central: "Today 7:30 PM CT", "Tomorrow 1:00 PM CT",
 * "Sun 1:00 PM CT", or "Oct 24, 1:00 PM CT"
 */
export function lockTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const clock = at.toLocaleTimeString(
    'en-US',
    inSiteZone({ hour: 'numeric', minute: '2-digit' })
  );
  const time = `${clock} ${SITE_ZONE_LABEL}`;
  const days = siteDayDiff(at, now);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (Math.abs(days) < 7) {
    const weekday = at.toLocaleDateString(
      'en-US',
      inSiteZone({ weekday: 'short' })
    );
    return `${weekday} ${time}`;
  }
  const date = at.toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', day: 'numeric' })
  );
  return `${date}, ${time}`;
}
