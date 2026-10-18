import React from 'react';
import { formatAmerican, payout } from '../../shared/odds';
import type { BetResult, FeedLeg, FeedPost } from '../../shared/posts';
import { gameState } from '../../shared/live';

// Building blocks of a slip card, shared by regular slips and group parlays.
// Slip layout follows a sportsbook bet slip: a title bar with the total
// odds, picks strung on a vertical timeline, then wager/payout totals.

export const RESULT_STYLES: Record<BetResult, string> = {
  PENDING: 'bg-gray-800 text-gray-300',
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  PUSH: 'bg-yellow-500/15 text-yellow-300',
  VOID: 'bg-gray-800 text-gray-500',
};

/** Timeline dot per result: hollow while pending, filled once settled */
export const NODE_STYLES: Record<BetResult, string> = {
  PENDING: 'border-gray-600 bg-gray-900',
  WON: 'border-emerald-500 bg-emerald-500',
  LOST: 'border-red-400 bg-red-400',
  PUSH: 'border-yellow-300 bg-yellow-300',
  VOID: 'border-gray-600 bg-gray-800',
};

export const RESULT_OPTIONS: BetResult[] = [
  'PENDING',
  'WON',
  'LOST',
  'PUSH',
  'VOID',
];

export const units = (n: number) => `${Math.round(n * 100) / 100}u`;

/** What a stake returns: nothing on a loss, the stake back on push/void.
 *  Pending bets show what they'd return if they hit. */
export function returned(stake: number, decimal: number, result: BetResult) {
  if (result === 'LOST') return 0;
  if (result === 'PUSH' || result === 'VOID') return stake;
  return payout(stake, decimal);
}

export const PAYOUT_LABELS: Record<BetResult, string> = {
  PENDING: '$10 pays',
  WON: '$10 paid',
  LOST: 'Payout',
  PUSH: 'Payout',
  VOID: 'Payout',
};

/** Green only for money actually won; plain while pending, muted for $0 or a refund */
export const payoutColor = (result: BetResult) => {
  if (result === 'WON') return 'text-win';
  if (result === 'PENDING') return '';
  return 'text-gray-400';
};

/** Big pick line + small uppercase market line, e.g. "Bills -3.5" / "SPREAD" */
export function legText(leg: FeedLeg): { title: string; market: string } {
  const line = leg.line == null ? '' : ` ${leg.line}`;
  switch (leg.marketKey) {
    case 'h2h':
      return { title: leg.selection, market: 'Moneyline' };
    case 'spreads':
      return {
        title: `${leg.selection} ${leg.line != null && leg.line > 0 ? '+' : ''}${leg.line ?? ''}`,
        market: 'Spread',
      };
    case 'totals':
      return { title: `${leg.selection}${line}`, market: 'Total' };
    default: {
      // Yes/no props ("Anytime TD") read better without the "Yes"
      const pick =
        leg.selection === 'Yes' ? leg.marketLabel : `${leg.selection}${line}`;
      return {
        title: `${leg.playerName} ${pick}`,
        market: `${leg.playerName} - ${leg.marketLabel}`,
      };
    }
  }
}

export function slipTitle(post: FeedPost): string {
  const { legs } = post.bets[0];
  if (post.type === 'LADDER') return `${post.bets.length} Rung Ladder`;
  const sameGame = legs.every((l) => l.eventLabel === legs[0].eventLabel);
  return `${legs.length} Leg ${sameGame ? 'Same Game ' : ''}Parlay`;
}

/**
 * A result as a status badge. Results grade themselves when games end; the
 * poster's manual override lives in the ⋯ menu so it doesn't clutter the slip.
 */
export function ResultBadge({ result }: { result: BetResult }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${RESULT_STYLES[result]}`}
    >
      {result}
    </span>
  );
}

/** "PASSING YARDS" -> "PASSING YARDS · FINAL 278" once a prop is graded */
export const withFinal = (market: string, actual: number | null) =>
  actual == null ? market : `${market} · Final ${actual}`;

/** One stop on the slip's timeline; the connector runs down to the next stop */
export function TimelineRow({
  result,
  last,
  children,
}: {
  result: BetResult;
  last: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative pl-10 pr-4">
      <span
        aria-hidden="true"
        className={`absolute left-4 top-4 h-3 w-3 rounded-full border-2 ${NODE_STYLES[result]}`}
      />
      {!last && (
        <span
          aria-hidden="true"
          className="absolute -bottom-4 left-[21.5px] top-7 w-px bg-gray-700"
        />
      )}
      <div className={`py-3 ${last ? '' : 'border-b border-gray-800'}`}>
        {children}
      </div>
    </li>
  );
}

/** A game in progress. Only shown on unsettled bets and legs. */
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-red-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
      </span>
      LIVE
    </span>
  );
}

/**
 * The status chip for one unsettled leg of a multi-game slip: LIVE while its
 * game is on, PENDING once the game is over but the grade isn't in yet,
 * nothing before kickoff.
 */
export function legStatus(leg: FeedLeg, now: number): React.ReactNode {
  if (leg.result !== 'PENDING') return null;
  const state = gameState(leg.startsAt, leg.gameFinal, now);
  if (state === 'live') return <LiveBadge />;
  if (state === 'final') return <ResultBadge result="PENDING" />;
  return null;
}

export function LegRow({
  leg,
  result,
  last,
  tag,
}: {
  leg: FeedLeg;
  result: BetResult;
  last: boolean;
  /** LIVE / PENDING chip beside the game, for multi-game slips */
  tag?: React.ReactNode;
}) {
  const { title, market } = legText(leg);
  return (
    // A graded leg shows its own result; otherwise it follows the bet's
    <TimelineRow
      result={leg.result !== 'PENDING' ? leg.result : result}
      last={last}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold leading-snug">{title}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {withFinal(market, leg.actual)}
          </p>
        </div>
        <span className="font-mono font-bold tabular-nums">
          {formatAmerican(leg.americanOdds)}
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
        {leg.eventLabel}
        {tag}
      </p>
    </TimelineRow>
  );
}

export function Total({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="font-bold tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
    </div>
  );
}
