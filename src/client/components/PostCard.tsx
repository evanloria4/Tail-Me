import React, { useState } from 'react';
import { formatAmerican, formatMoney, payout } from '../../shared/odds';
import { BetResult, FeedBet, FeedLeg, FeedPost } from '../../shared/posts';
import timeAgo from '../lib/time';

// Slip layout follows a sportsbook bet slip: a title bar with the total
// odds, picks strung on a vertical timeline, then wager/payout totals.

const RESULT_STYLES: Record<BetResult, string> = {
  PENDING: 'bg-gray-800 text-gray-300',
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  PUSH: 'bg-yellow-500/15 text-yellow-300',
  VOID: 'bg-gray-800 text-gray-500',
};

/** Timeline dot per result: hollow while pending, filled once settled */
const NODE_STYLES: Record<BetResult, string> = {
  PENDING: 'border-gray-600 bg-gray-900',
  WON: 'border-emerald-500 bg-emerald-500',
  LOST: 'border-red-400 bg-red-400',
  PUSH: 'border-yellow-300 bg-yellow-300',
  VOID: 'border-gray-600 bg-gray-800',
};

const RESULT_OPTIONS: BetResult[] = ['PENDING', 'WON', 'LOST', 'PUSH', 'VOID'];

const units = (n: number) => `${Math.round(n * 100) / 100}u`;

/** What a stake returns: nothing on a loss, the stake back on push/void.
 *  Pending bets show what they'd return if they hit. */
function returned(stake: number, decimal: number, result: BetResult) {
  if (result === 'LOST') return 0;
  if (result === 'PUSH' || result === 'VOID') return stake;
  return payout(stake, decimal);
}

const PAYOUT_LABELS: Record<BetResult, string> = {
  PENDING: '$10 pays',
  WON: '$10 paid',
  LOST: 'Payout',
  PUSH: 'Payout',
  VOID: 'Payout',
};

/** Green only for money actually won; plain while pending, muted for $0 or a refund */
const payoutColor = (result: BetResult) => {
  if (result === 'WON') return 'text-win';
  if (result === 'PENDING') return '';
  return 'text-gray-400';
};

/** Big pick line + small uppercase market line, e.g. "Bills -3.5" / "SPREAD" */
function legText(leg: FeedLeg): { title: string; market: string } {
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

function slipTitle(post: FeedPost): string {
  const { legs } = post.bets[0];
  if (post.type === 'LADDER') return `${post.bets.length} Rung Ladder`;
  const sameGame = legs.every((l) => l.eventLabel === legs[0].eventLabel);
  return `${legs.length} Leg ${sameGame ? 'Same Game ' : ''}Parlay`;
}

function ResultControl({
  bet,
  isAuthor,
  onSettle,
}: {
  bet: FeedBet;
  isAuthor: boolean;
  onSettle: (betId: string, result: BetResult) => void;
}) {
  const style = `rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${RESULT_STYLES[bet.result]}`;
  if (!isAuthor) return <span className={style}>{bet.result}</span>;
  return (
    <select
      aria-label="Bet result"
      value={bet.result}
      onChange={(e) => onSettle(bet.id, e.target.value as BetResult)}
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

/** One stop on the slip's timeline; the connector runs down to the next stop */
function TimelineRow({
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

function LegRow({
  leg,
  result,
  last,
}: {
  leg: FeedLeg;
  result: BetResult;
  last: boolean;
}) {
  const { title, market } = legText(leg);
  return (
    <TimelineRow result={result} last={last}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold leading-snug">{title}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {market}
          </p>
        </div>
        <span className="font-mono font-bold tabular-nums">
          {formatAmerican(leg.americanOdds)}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-emerald-400">{leg.eventLabel}</p>
    </TimelineRow>
  );
}

function Total({
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

/** Where Tail lands when a pick has no add-to-betslip link (typed-in slips) */
const BOOK_HOMEPAGES: Record<string, string> = {
  fanduel: 'https://sportsbook.fanduel.com',
  draftkings: 'https://sportsbook.draftkings.com',
  williamhill_us: 'https://www.caesars.com/sportsbook-and-casino',
  betmgm: 'https://sports.betmgm.com',
  espnbet: 'https://espnbet.com',
  fanatics: 'https://sportsbook.fanatics.com',
};

type TailPick = {
  id: string;
  title: string;
  odds: number;
  link: string | null;
};

function tailPicks(post: FeedPost): TailPick[] {
  if (post.type === 'LADDER') {
    return post.bets.map((b) => {
      const leg = b.legs[0];
      const who = leg.playerName ? `${leg.playerName} ` : '';
      return {
        id: b.id,
        title: `${who}${leg.selection} ${leg.line ?? ''}`.trim(),
        odds: b.americanOdds,
        link: b.deepLink ?? leg.deepLink,
      };
    });
  }
  return post.bets[0].legs.map((l) => ({
    id: l.id,
    title: legText(l).title,
    odds: l.americanOdds,
    link: l.deepLink,
  }));
}

const tailButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/10';

/** Shown once tailed: a status, not a control */
function TailedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-400">
      ✓ Tailed
    </span>
  );
}

/**
 * Tail: straights open the pick straight onto the book's bet slip. Parlays and
 * ladders list each pick with its own add link, since a book link adds one
 * selection at a time (the book's slip collects them into the parlay).
 */
function TailSection({
  post,
  onTail,
  children,
}: {
  post: FeedPost;
  onTail: (postId: string) => void;
  /** Left side of the row (the tail count) */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const tailed = post.bets.some((b) => b.tailedByMe);
  const picks = tailPicks(post);
  const book = post.sportsbook.name;
  const home = BOOK_HOMEPAGES[post.sportsbook.key] ?? null;
  const linked = picks.every((pk) => pk.link);
  const single = picks.length === 1 && (picks[0].link || home);

  let control: React.ReactNode;
  if (tailed) control = <TailedBadge />;
  else if (single)
    control = (
      <a
        href={picks[0].link ?? home!}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onTail(post.id)}
        className={tailButtonClass}
      >
        Tail ↗
      </a>
    );
  else
    control = (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onTail(post.id);
        }}
        className={tailButtonClass}
      >
        Tail
      </button>
    );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {children}
        {control}
      </div>
      {/* Stays open after tailing so each pick can still be added */}
      {open && !single && (
        <div className="mt-3 space-y-2">
          {linked ? (
            <>
              <p className="text-xs text-gray-500">
                {post.type === 'LADDER'
                  ? `Each rung is its own bet. Add the ones you want to your ${book} slip.`
                  : `Add each pick to your ${book} slip. ${book} builds the parlay as you add them.`}
              </p>
              <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
                {picks.map((pk) => (
                  <li key={pk.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {pk.title}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-gray-400">
                      {formatAmerican(pk.odds)}
                    </span>
                    <a
                      href={pk.link!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-gray-950 hover:bg-emerald-400"
                    >
                      Add ↗
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              This slip was entered by hand, so its picks can&apos;t be added
              automatically.{' '}
              {home && (
                <a
                  href={home}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-400 hover:underline"
                >
                  Open {book} ↗
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PostCard({
  post,
  currentUserId,
  onSettle,
  onDelete,
  onTail,
}: {
  post: FeedPost;
  currentUserId?: string;
  onSettle: (betId: string, result: BetResult) => void;
  onDelete: (postId: string) => void;
  onTail: (postId: string) => void;
}) {
  const isAuthor = post.author.id === currentUserId;
  const tails = Math.max(...post.bets.map((b) => b.tailCount));
  const tailCountLabel = `${tails} ${tails === 1 ? 'tail' : 'tails'}`;
  // Others can tail while a bet is open; a tailed slip keeps its badge after
  const canTail =
    post.bets.some((b) => b.tailedByMe) ||
    (!isAuthor && post.bets.some((b) => b.result === 'PENDING'));
  const first = post.bets[0];
  const isLadder = post.type === 'LADDER';
  const isStraight = post.type === 'STRAIGHT';
  const pick = first.legs[0];

  const rungsHit = post.bets.filter((b) => b.result === 'WON').length;
  const ladderSettled = post.bets.some((b) => b.result !== 'PENDING');
  const allSettled = post.bets.every((b) => b.result !== 'PENDING');
  const ladderRisked = post.bets.reduce((s, b) => s + b.units, 0);
  const ladderReturn = post.bets.reduce(
    (s, b) => s + returned(b.units, b.decimalOdds, b.result),
    0
  );

  // A parlay's legs share the bet's result only once it has won; a lost
  // parlay doesn't say which leg missed, so those dots stay neutral.
  const legResult: BetResult = first.result === 'WON' ? 'WON' : 'PENDING';

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
      <header className="flex items-center gap-3 px-4 pt-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-emerald-500/20 font-bold uppercase text-emerald-400">
          {post.author.fullName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            {post.author.fullName}
          </p>
          <p className="truncate text-sm text-gray-500">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </p>
        </div>
      </header>

      {post.caption && (
        <p className="whitespace-pre-wrap px-4 pt-3 text-gray-200">
          {post.caption}
        </p>
      )}

      <div className="m-4 overflow-hidden rounded-xl border border-gray-800">
        {/* Title bar */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div className="min-w-0">
            {isStraight ? (
              // A single pick is the slip's headline, like a book's bet receipt
              <>
                <p className="text-lg font-bold leading-tight">
                  {legText(pick).title}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {legText(pick).market}
                </p>
                <p className="mt-1.5 text-xs text-emerald-400">
                  {pick.eventLabel}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold leading-tight">
                {slipTitle(post)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-gray-700 px-1.5 py-px text-[11px] font-semibold text-gray-400">
                {post.sportsbook.name}
              </span>
              {!isLadder && (
                <ResultControl
                  bet={first}
                  isAuthor={isAuthor}
                  onSettle={onSettle}
                />
              )}
            </div>
          </div>
          {!isLadder && (
            <span className="font-mono text-lg font-bold tabular-nums">
              {formatAmerican(first.americanOdds)}
            </span>
          )}
          {isLadder && ladderSettled && (
            <div className="text-right">
              <p className="text-lg font-bold leading-tight tabular-nums">
                {rungsHit}/{post.bets.length}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Hit
              </p>
            </div>
          )}
        </div>

        {isLadder ? (
          <>
            <div className="border-b border-gray-800 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {pick.playerName
                  ? `${pick.playerName} - ${pick.marketLabel}`
                  : legText(pick).market}
              </p>
              <p className="mt-1 text-xs text-emerald-400">{pick.eventLabel}</p>
            </div>
            <ol>
              {post.bets.map((bet, i) => {
                const leg = bet.legs[0];
                return (
                  <TimelineRow
                    key={bet.id}
                    result={bet.result}
                    last={i === post.bets.length - 1}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold">
                        {leg.selection} {leg.line}
                      </p>
                      <span className="font-mono font-bold tabular-nums">
                        {formatAmerican(bet.americanOdds)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                      <span>
                        {units(bet.units)}{' '}
                        {bet.result === 'PENDING' ? 'pays' : 'paid'}{' '}
                        <span
                          className={`font-semibold ${payoutColor(bet.result)}`}
                        >
                          {units(
                            returned(bet.units, bet.decimalOdds, bet.result)
                          )}
                        </span>
                      </span>
                      <ResultControl
                        bet={bet}
                        isAuthor={isAuthor}
                        onSettle={onSettle}
                      />
                    </div>
                  </TimelineRow>
                );
              })}
            </ol>
          </>
        ) : (
          !isStraight && (
            <ol>
              {first.legs.map((leg, i) => (
                <LegRow
                  key={leg.id}
                  leg={leg}
                  result={legResult}
                  last={i === first.legs.length - 1}
                />
              ))}
            </ol>
          )
        )}

        {/* Totals */}
        <div className="flex items-end justify-between gap-4 border-t border-gray-800 bg-gray-950 px-4 py-3">
          {isLadder ? (
            <>
              <Total label="Units risked" value={units(ladderRisked)} />
              <Total
                align="right"
                // Until every rung settles, assume the open ones hit
                label={allSettled ? 'Payout' : 'Max payout'}
                value={
                  <span
                    className={
                      // eslint-disable-next-line no-nested-ternary
                      !allSettled
                        ? ''
                        : rungsHit > 0
                          ? 'text-win'
                          : 'text-gray-400'
                    }
                  >
                    {units(ladderReturn)}
                  </span>
                }
              />
            </>
          ) : (
            <>
              <Total label="Units" value={units(first.units)} />
              <Total
                align="right"
                label={PAYOUT_LABELS[first.result]}
                value={
                  <span className={payoutColor(first.result)}>
                    {formatMoney(returned(10, first.decimalOdds, first.result))}
                  </span>
                }
              />
            </>
          )}
        </div>
      </div>

      {canTail ? (
        <footer className="px-4 pb-4 text-sm text-gray-500">
          <TailSection post={post} onTail={onTail}>
            <span>{tailCountLabel}</span>
          </TailSection>
        </footer>
      ) : (
        <footer className="flex items-center justify-between px-4 pb-4 text-sm text-gray-500">
          <span>{tailCountLabel}</span>
          {isAuthor && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="text-gray-500 hover:text-red-400"
            >
              Delete
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
