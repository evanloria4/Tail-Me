// What the ⋯ menu says about edit / add rung / delete: allowed with a hint
// ("Until 7:20 PM CT", "12 min left"), or greyed out with why. Same rules as
// canEditSlip / canAddRung / deleteRule, which the server enforces.
import {
  canAddRung,
  canEditSlip,
  DELETE_GRACE_MINUTES,
  deleteRule,
  LADDER_MAX_RUNGS,
  type FeedPost,
} from '../../shared/posts';
import { inSiteZone, siteDayKey } from '../../shared/time';

export type ActionState = { allowed: boolean; note: string | null };

const legsOf = (post: FeedPost) => post.bets.flatMap((b) => b.legs);

const graded = (post: FeedPost) =>
  post.bets.some(
    (b) => b.result !== 'PENDING' || b.legs.some((l) => l.result !== 'PENDING')
  );

/** "7:20 PM CT" today, "Sun 12:00 PM CT" another day */
export function kickoffLabel(start: Date, now = new Date()): string {
  const sameDay = siteDayKey(start) === siteDayKey(now);
  const time = start.toLocaleTimeString(
    'en-US',
    inSiteZone({
      ...(sameDay ? {} : { weekday: 'short' }),
      hour: 'numeric',
      minute: '2-digit',
    })
  );
  return `${time} CT`;
}

/** "Until <first kickoff>", or null when no leg has a start time */
function untilKickoff(post: FeedPost, now: Date): string | null {
  const starts = legsOf(post)
    .map((l) => (l.startsAt ? new Date(l.startsAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (!starts.length) return null;
  return `Until ${kickoffLabel(new Date(Math.min(...starts)), now)}`;
}

/** Why the author can't change it anymore */
const lockReason = (post: FeedPost) =>
  graded(post) ? 'Locked once graded' : 'Locked at kickoff';

/** Edit slip (straights and parlays only; null = not offered) */
export function editState(
  post: FeedPost,
  now: Date,
  asAdmin: boolean
): ActionState | null {
  if (post.type !== 'STRAIGHT' && post.type !== 'PARLAY') return null;
  if (asAdmin) return { allowed: true, note: null };
  return canEditSlip(post, now)
    ? { allowed: true, note: untilKickoff(post, now) }
    : { allowed: false, note: lockReason(post) };
}

/** Add rung (ladders only; null = not offered) */
export function rungState(
  post: FeedPost,
  now: Date,
  asAdmin: boolean
): ActionState | null {
  if (post.type !== 'LADDER') return null;
  if (post.bets.length >= LADDER_MAX_RUNGS)
    return { allowed: false, note: `Max ${LADDER_MAX_RUNGS} rungs` };
  if (asAdmin) return { allowed: true, note: null };
  return canAddRung(post, now)
    ? { allowed: true, note: untilKickoff(post, now) }
    : { allowed: false, note: lockReason(post) };
}

/** Delete slip: how long it can be taken back, or that it stays on the record */
export function deleteState(
  post: FeedPost,
  now: Date,
  asAdmin: boolean
): ActionState {
  const rule = deleteRule(post, now, asAdmin);
  if (rule === 'blocked')
    return {
      allowed: false,
      note: `Settle it first (${DELETE_GRACE_MINUTES} min passed)`,
    };
  if (rule === 'hide') return { allowed: true, note: 'Still counts in stats' };
  if (post.type === 'GROUP_PARLAY')
    return { allowed: true, note: 'Until it locks' };
  const left = Math.ceil(
    (new Date(post.createdAt).getTime() +
      DELETE_GRACE_MINUTES * 60_000 -
      now.getTime()) /
      60_000
  );
  // An admin past the window can still delete, with no clock on it
  return { allowed: true, note: left > 0 ? `${left} min left` : null };
}
