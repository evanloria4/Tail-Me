import React from 'react';
import { formatAmerican, formatMoney, payout } from '../../shared/odds';
import {
  BetResult,
  describeLeg,
  FeedBet,
  FeedPost,
  MARKETS,
} from '../../shared/posts';
import timeAgo from '../lib/time';

const RESULT_STYLES: Record<BetResult, string> = {
  PENDING: 'bg-gray-800 text-gray-300',
  WON: 'bg-emerald-500/15 text-emerald-400',
  LOST: 'bg-red-500/15 text-red-400',
  PUSH: 'bg-yellow-500/15 text-yellow-300',
  VOID: 'bg-gray-800 text-gray-500',
};

const RESULT_OPTIONS: BetResult[] = ['PENDING', 'WON', 'LOST', 'PUSH', 'VOID'];

const TYPE_LABELS: Record<FeedPost['type'], string> = {
  STRAIGHT: 'Straight',
  PARLAY: 'Parlay',
  LADDER: 'Ladder',
};

function ResultControl({
  bet,
  isAuthor,
  onSettle,
}: {
  bet: FeedBet;
  isAuthor: boolean;
  onSettle: (betId: string, result: BetResult) => void;
}) {
  const style = `rounded-md px-2 py-0.5 text-xs font-semibold ${RESULT_STYLES[bet.result]}`;
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

function Pays({ decimal }: { decimal: number }) {
  return (
    <span className="text-sm text-gray-300">
      $10 pays{' '}
      <span className="font-semibold text-emerald-400">
        {formatMoney(payout(10, decimal))}
      </span>
    </span>
  );
}

function units(n: number) {
  return `${n}u`;
}

export default function PostCard({
  post,
  currentUserId,
  onSettle,
  onDelete,
}: {
  post: FeedPost;
  currentUserId?: string;
  onSettle: (betId: string, result: BetResult) => void;
  onDelete: (postId: string) => void;
}) {
  const isAuthor = post.author.id === currentUserId;
  const tails = post.bets.reduce((sum, b) => sum + b.tailCount, 0);
  const first = post.bets[0];
  const pick = first.legs[0];

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
      <header className="flex items-center gap-3 px-4 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 font-bold uppercase text-emerald-400">
          {post.author.fullName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate">
            <span className="font-semibold">{post.author.fullName}</span>{' '}
            <span className="text-sm text-gray-500">
              @{post.author.username}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            {timeAgo(post.createdAt)} · {post.sportsbook.name}
          </p>
        </div>
        <span className="rounded-md bg-gray-800 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-300">
          {TYPE_LABELS[post.type]}
          {post.type === 'PARLAY' && ` · ${first.legs.length} legs`}
        </span>
      </header>

      {post.caption && (
        <p className="whitespace-pre-wrap px-4 pt-3 text-gray-200">
          {post.caption}
        </p>
      )}

      <div className="m-4 rounded-xl border border-gray-800 bg-gray-950">
        {post.type === 'LADDER' ? (
          <>
            <div className="border-b border-gray-800 px-4 py-3">
              <p className="font-semibold">
                {pick.marketKey === 'player_prop'
                  ? `${pick.playerName} ${pick.selection} ${pick.marketLabel}`
                  : `${pick.selection} · ${MARKETS[pick.marketKey]}`}
              </p>
              <p className="text-xs text-gray-500">{pick.eventLabel}</p>
            </div>
            {post.bets.map((bet) => (
              <div
                key={bet.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-2.5 last:border-b-0"
              >
                <span className="w-20 font-mono font-semibold">
                  {bet.legs[0].line}
                </span>
                <span className="w-14 font-mono text-gray-300">
                  {formatAmerican(bet.americanOdds)}
                </span>
                <span className="w-12 text-sm text-gray-400">
                  {units(bet.units)}
                </span>
                <Pays decimal={bet.decimalOdds} />
                <ResultControl
                  bet={bet}
                  isAuthor={isAuthor}
                  onSettle={onSettle}
                />
              </div>
            ))}
          </>
        ) : (
          <>
            {first.legs.map((leg) => (
              <div
                key={leg.id}
                className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{describeLeg(leg)}</p>
                  <p className="text-xs text-gray-500">{leg.eventLabel}</p>
                </div>
                <span className="font-mono text-gray-300">
                  {formatAmerican(leg.americanOdds)}
                </span>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="text-sm text-gray-400">
                {units(first.units)} ·{' '}
                <span className="font-mono text-white">
                  {formatAmerican(first.americanOdds)}
                </span>
              </span>
              <Pays decimal={first.decimalOdds} />
              <ResultControl
                bet={first}
                isAuthor={isAuthor}
                onSettle={onSettle}
              />
            </div>
          </>
        )}
      </div>

      <footer className="flex items-center justify-between px-4 pb-4 text-sm text-gray-500">
        <span>
          {tails} {tails === 1 ? 'tail' : 'tails'}
        </span>
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
    </article>
  );
}
