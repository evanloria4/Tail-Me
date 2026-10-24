import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import timeAgo, { lockTime } from '../lib/time';
import useNow from '../lib/useNow';
import { allFinal, isLive, oneGame } from '../../shared/live';
import {
  formatAmerican,
  formatMoney,
  isValidAmerican,
} from '../../shared/odds';
import {
  hasBookPrice,
  isGroupLocked,
  isSameGameLegs,
} from '../../shared/posts';
import type { BetResult, FeedLeg, FeedPost } from '../../shared/posts';
import { useLayout } from './AppLayout';
import UserAvatar from './UserAvatar';
import {
  legStatus,
  legText,
  LiveBadge,
  GameScore,
  PAYOUT_LABELS,
  payoutColor,
  RESULT_OPTIONS,
  RESULT_STYLES,
  ResultBadge,
  returned,
  TimelineRow,
  useLegPreview,
  Total,
  withFinal,
  legStatBar,
} from './SlipParts';

// A group parlay on a slip card: one leg per friend, open until the
// deadline or the creator locks it, then placed by anyone and graded leg by
// leg so everyone can see whose leg cashed it or busted it.

export type GroupHandlers = {
  settleLeg: (postId: string, legId: string, result: BetResult) => void;
  removeLeg: (postId: string, legId: string) => void;
  lock: (postId: string) => void;
  /** Creator enters the book's price once locked */
  setPrice: (postId: string, americanOdds: number) => void;
};

export const groupLocked = (post: FeedPost) =>
  !!post.group && isGroupLocked(post.group);

const firstName = (fullName: string) => fullName.split(' ')[0];

/**
 * A graded leg's one indicator: a green check for a hit, a red X for a miss,
 * the word for a push or void, nothing while it's open.
 */
function ResultMark({ result }: { result: BetResult }) {
  if (result === 'PENDING') return null;
  if (result === 'WON' || result === 'LOST') {
    const won = result === 'WON';
    return (
      <span
        role="img"
        aria-label={won ? 'Hit' : 'Missed'}
        title={won ? 'Hit' : 'Missed'}
        className={`flex h-5 w-5 items-center justify-center rounded-full ${
          won
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-red-500/15 text-red-400'
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {won ? (
            <path d="M4.5 10.5l3.5 3.5 7.5-8" />
          ) : (
            <path d="M6 6l8 8M14 6l-8 8" />
          )}
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${RESULT_STYLES[result]}`}
    >
      {result}
    </span>
  );
}

function LegControl({
  leg,
  canSettle,
  canRemove,
  onSettle,
  onRemove,
}: {
  leg: FeedLeg;
  canSettle: boolean;
  canRemove: boolean;
  onSettle: (result: BetResult) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const style = `rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${RESULT_STYLES[leg.result]}`;
  // Legs grade themselves when games end; the owner or creator can still fix
  // one through a small pencil, so the list stays clean
  if (canSettle && editing) {
    return (
      <select
        aria-label="Leg result"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={leg.result}
        onChange={(e) => {
          onSettle(e.target.value as BetResult);
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className={`${style} cursor-pointer border-none outline-none`}
      >
        {RESULT_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    );
  }
  if (canSettle) {
    return (
      <span className="flex items-center gap-1">
        <ResultMark result={leg.result} />
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Change leg result"
          title="Change result"
          className="rounded p-0.5 text-gray-600 transition hover:text-gray-300"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13.5 3.5l3 3L7 16H4v-3z" />
          </svg>
        </button>
      </span>
    );
  }
  if (canRemove) {
    return (
      <button
        type="button"
        onClick={onRemove}
        className="text-xs font-medium text-gray-500 hover:text-red-400"
      >
        Remove
      </button>
    );
  }
  return <ResultMark result={leg.result} />;
}

/** Who a leg belongs to: their initial and first name ("You" for yours) */
function Owner({ owner, mine }: { owner: FeedLeg['addedBy']; mine: boolean }) {
  if (!owner) return <span className="text-gray-500">Former member</span>;
  return (
    <Link
      to={`/u/${owner.username}`}
      className="inline-flex items-center gap-1.5 font-semibold text-gray-300 hover:underline"
    >
      <UserAvatar
        name={owner.fullName}
        url={owner.avatarUrl}
        color={owner.avatarColor}
        className="h-5 w-5 text-[10px]"
      />
      {mine ? 'You' : firstName(owner.fullName)}
    </Link>
  );
}

/** Odds in the title bar, with the book's price (or a way to enter it) */
function GroupOdds({
  post,
  canPrice,
  onPrice,
}: {
  post: FeedPost;
  canPrice: boolean;
  onPrice: (americanOdds: number) => void;
}) {
  const bet = post.bets[0];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const priced = hasBookPrice(bet);
  // Different games multiply exactly; one game only estimates until priced
  const estimate = isSameGameLegs(bet.legs) && !priced;

  if (editing) {
    const save = (e: React.FormEvent) => {
      e.preventDefault();
      const odds = Number(draft.trim().replace(/^\+/, ''));
      if (!isValidAmerican(odds)) {
        setError('Like +850 or -120');
        return;
      }
      onPrice(odds);
      setEditing(false);
    };
    return (
      <form onSubmit={save} className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <input
            aria-label={`${post.sportsbook.name} price`}
            inputMode="numeric"
            placeholder="+850"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-20 rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-right font-mono text-sm text-white outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-gray-950 hover:bg-emerald-400"
          >
            Save
          </button>
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex flex-none flex-col items-end">
      <span className="font-mono text-lg font-bold tabular-nums">
        {formatAmerican(bet.americanOdds)}
      </span>
      {estimate && (
        <span
          title="Same-game parlays price lower at the book than the legs multiplied"
          className="text-[10px] font-semibold uppercase tracking-wider text-gray-500"
        >
          est.
        </span>
      )}
      {priced && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {post.sportsbook.name} price
        </span>
      )}
      {canPrice && (
        <button
          type="button"
          onClick={() => {
            setDraft(priced ? formatAmerican(bet.americanOdds) : '');
            setError(null);
            setEditing(true);
          }}
          className="mt-0.5 text-xs font-semibold text-emerald-400 hover:underline"
        >
          {priced ? 'Edit price' : `Set ${post.sportsbook.name} price`}
        </button>
      )}
    </div>
  );
}

/** Title bar, legs and totals inside the slip box */
export function GroupSlip({
  post,
  handlers,
}: {
  post: FeedPost;
  handlers: GroupHandlers;
}) {
  const { profile } = useAuth();
  const bet = post.bets[0];
  const group = post.group!;
  const locked = groupLocked(post);
  const isCreator = post.author.id === profile?.id;
  const statusClass =
    'rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide';
  // Ticks each minute so LIVE tags come and go on their own
  const now = useNow();
  const singleGame = oneGame(bet.legs);
  // Legs that happen to share a game read as an SGP too, flagged or not
  const sgp = isSameGameLegs(bet.legs);
  // Long group parlays show the first few legs and a "View all" row
  const legList = useLegPreview(bet.legs);

  let status: React.ReactNode;
  let when: string;
  if (!locked) {
    status = (
      <span className={`${statusClass} bg-emerald-500/15 text-emerald-400`}>
        OPEN
      </span>
    );
    when = `Locks ${lockTime(group.lockAt)} · ${timeAgo(group.lockAt)}`;
  } else {
    if (bet.result !== 'PENDING') status = <ResultBadge result={bet.result} />;
    // One game: the slip carries the LIVE tag; several: each leg does
    else if (singleGame && isLive(bet.legs, now)) {
      // The score beside the game chip says it's live when there is one
      status = bet.legs[0].score ? null : <LiveBadge />;
    } else if (allFinal(bet.legs, now))
      status = <ResultBadge result="PENDING" />;
    else
      status = (
        <span className={`${statusClass} ${RESULT_STYLES.PENDING}`}>
          LOCKED
        </span>
      );
    when = `Locked ${lockTime(group.lockedAt ?? group.lockAt)}`;
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">👥 Group Parlay</p>
          <p
            className={`mt-1 text-xs font-medium ${locked ? 'text-gray-500' : 'text-emerald-400'}`}
          >
            🔒 {when}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-gray-700 px-1.5 py-px text-[11px] font-semibold text-gray-400">
              {post.sportsbook.name}
            </span>
            {status}
            {(group.game || sgp) && (
              <span className={`${statusClass} bg-gray-800 text-gray-300`}>
                🎯 {group.game?.eventLabel ?? bet.legs[0].eventLabel} SGP
              </span>
            )}
            {singleGame && locked && (
              <span className="text-xs">
                <GameScore leg={bet.legs[0]} now={now} />
              </span>
            )}
          </div>
        </div>
        <GroupOdds
          post={post}
          canPrice={isCreator && locked && bet.result === 'PENDING'}
          onPrice={(odds) => handlers.setPrice(post.id, odds)}
        />
      </div>

      <ol>
        {legList.visible.map((leg, i) => {
          const { title, market } = legText(leg);
          const owner = leg.addedBy;
          const mine = owner?.id === profile?.id;
          const canEdit = mine || isCreator || !!profile?.isAdmin;
          const bar = legStatBar(leg, now);
          return (
            <TimelineRow
              key={leg.id}
              result={leg.result}
              last={i === legList.visible.length - 1}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{title}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {bar ? market : withFinal(market, leg.actual)}
                  </p>
                </div>
                <span className="font-mono font-bold tabular-nums">
                  {formatAmerican(leg.americanOdds)}
                </span>
              </div>
              {bar}
              {/* A one-game parlay already says its game up top */}
              {!group.game && !sgp && (
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
                  {leg.eventLabel}
                  <GameScore leg={leg} now={now} />
                  {!singleGame &&
                    locked &&
                    bet.result === 'PENDING' &&
                    legStatus(leg, now)}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 text-gray-400">
                  <Owner owner={owner} mine={mine} />
                  {leg.result === 'LOST' && (
                    <span className="font-bold text-red-400">💀 Busted it</span>
                  )}
                </span>
                <LegControl
                  leg={leg}
                  canSettle={locked && canEdit}
                  canRemove={!locked && canEdit && bet.legs.length > 1}
                  onSettle={(r) => handlers.settleLeg(post.id, leg.id, r)}
                  onRemove={() => handlers.removeLeg(post.id, leg.id)}
                />
              </div>
            </TimelineRow>
          );
        })}
      </ol>
      {legList.toggle}

      <div className="flex items-end justify-between gap-4 border-t border-gray-800 bg-gray-950 px-4 py-3">
        <Total
          label={bet.legs.length === 1 ? 'Pick' : 'Picks'}
          value={bet.legs.length}
        />
        <Total
          align="right"
          label={PAYOUT_LABELS[bet.result]}
          value={
            <span className={payoutColor(bet.result)}>
              {formatMoney(returned(10, bet.decimalOdds, bet.result))}
            </span>
          }
        />
      </div>
    </>
  );
}

const actionClass =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition';

/** Footer while it's open: who's in, add your leg, lock it */
export function GroupActions({
  post,
  handlers,
}: {
  post: FeedPost;
  handlers: GroupHandlers;
}) {
  const { profile, isSubscribed } = useAuth();
  const { openComposer } = useLayout();
  const { legs } = post.bets[0];
  const isCreator = post.author.id === profile?.id;
  const joined = legs.some((l) => l.addedBy?.id === profile?.id);
  const count = legs.length;

  let join: React.ReactNode;
  if (joined) {
    join = (
      <span className={`${actionClass} bg-emerald-500/15 text-emerald-400`}>
        ✓ You&apos;re in
      </span>
    );
  } else if (isSubscribed) {
    join = (
      <button
        type="button"
        onClick={() =>
          openComposer({ postId: post.id, game: post.group?.game ?? null })
        }
        className={`${actionClass} bg-emerald-500 text-gray-950 hover:bg-emerald-400`}
      >
        + Add your leg
      </button>
    );
  } else {
    join = (
      <span className="text-xs text-gray-500">
        <Link to="/billing" className="text-emerald-400 hover:underline">
          Subscribers
        </Link>{' '}
        add legs. You can place it once it locks.
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span>
        {count} {count === 1 ? 'leg' : 'legs'} in
      </span>
      <div className="flex items-center gap-2">
        {isCreator && (
          <button
            type="button"
            onClick={() => handlers.lock(post.id)}
            disabled={count < 2}
            title={
              count < 2 ? 'Needs at least 2 legs' : 'No more legs after this'
            }
            className={`${actionClass} border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            🔒 Lock it
          </button>
        )}
        {join}
      </div>
    </div>
  );
}
