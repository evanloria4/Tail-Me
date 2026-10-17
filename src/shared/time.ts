// The site runs on Central time: every date and time it shows, and every day
// it groups by, is in America/Chicago no matter where the viewer is.

export const SITE_TIME_ZONE = 'America/Chicago';
/** Short label shown after times, e.g. "Sun 1:00 PM CT" */
export const SITE_ZONE_LABEL = 'CT';

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** The wall-clock date and time in Central for an instant */
export function siteParts(date: Date): Parts {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(partsFormat.formatToParts(date).find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in Central */
export function siteDayKey(date: Date): string {
  const p = siteParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Whole calendar days from `from` to `to`, counted in Central */
export function siteDayDiff(to: Date, from: Date): number {
  const dayMs = (d: Date) => {
    const p = siteParts(d);
    return Date.UTC(p.year, p.month - 1, p.day);
  };
  return Math.round((dayMs(to) - dayMs(from)) / 86400_000);
}

/** <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm") in Central */
export function toSiteInput(date: Date): string {
  const p = siteParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * The instant a Central wall-clock time ("YYYY-MM-DDTHH:mm") refers to, or
 * null if it doesn't parse. Handles daylight saving: the offset is measured at
 * the guess and re-checked once in case the guess crossed a change.
 */
export function fromSiteInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms: number) => {
    const p = siteParts(new Date(ms));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms;
  };
  let ms = wall - offsetAt(wall);
  ms = wall - offsetAt(ms);
  const result = new Date(ms);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** toLocale* options with the site's zone filled in */
export const inSiteZone = (
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions => ({ ...options, timeZone: SITE_TIME_ZONE });
