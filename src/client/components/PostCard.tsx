import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatAmerican, formatMoney } from '../../shared/odds';
import { BetResult, canBeFaded, FeedPost } from '../../shared/posts';
import timeAgo from '../lib/time';
import combinedSlipLink from '../../shared/betslip';
import useNow from '../lib/useNow';
import { allFinal, inGameMinutes, isLive, oneGame } from '../../shared/live';
import { slipBadges, slipTier } from '../../shared/badges';
import type { ReactionEmoji } from '../../shared/social';
import {
  Comments,
  CommentsToggle,
  CrowdChip,
  TIER_STYLES,
  ReactionBar,
  StreakChip,
  TailersButton,
  WinBanner,
} from './SlipSocial';
import {
  LegRow,
  legText,
  PAYOUT_LABELS,
  payoutColor,
  legStatus,
  useLegPreview,
  InGameBadge,
  LiveBadge,
  ResultBadge,
  returned,
  slipTitle,
  TimelineRow,
  Total,
  units,
  withFinal,
} from './SlipParts';
import {
  GroupActions,
  GroupHandlers,
  groupLocked,
  GroupSlip,
} from './GroupParlay';
import { SeriesBadge } from './SeriesCover';
import SlipMenu from './SlipMenu';
import UserAvatar from './UserAvatar';

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

const fadeButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-red-400/60 px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-400/10';

/**
 * "✓ Tailed" / "✓ Faded". While the slip is open its ✕ takes it back; once
 * settled it's just a status.
 */
function BackedBadge({
  label,
  tone,
  onUndo,
}: {
  label: string;
  tone: 'tail' | 'fade';
  onUndo?: () => void;
}) {
  const color =
    tone === 'tail'
      ? 'bg-emerald-500/15 text-emerald-400'
      : 'bg-red-400/15 text-red-400';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg py-1.5 pl-3 text-sm font-semibold ${color} ${onUndo ? 'pr-1.5' : 'pr-3'}`}
    >
      ✓ {label}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          title={`Undo ${label.toLowerCase()}`}
          aria-label={`Undo ${label.toLowerCase()}`}
          className="rounded px-1 leading-none opacity-70 transition hover:bg-white/10 hover:opacity-100"
        >
          ✕
        </button>
      )}
    </span>
  );
}

export type BackAction = 'tail' | 'untail' | 'fade' | 'unfade';

/**
 * Tail: straights, parlays and ladders open every pick straight onto the
 * book's bet slip in one link. Slips without usable links (typed-in, other
 * books) list each pick with its own add link instead. Fade bets against it
 * (no link; it's on the record). One or the other: tailing drops a fade and
 * vice versa. While the slip is open either can be undone, and "Bet again"
 * reopens the book without counting a second tail.
 */
function TailSection({
  post,
  onBack,
  children,
  verb = 'Tail',
  canFade,
}: {
  post: FeedPost;
  onBack: (postId: string, action: BackAction) => void;
  /** Left side of the row (the tail / fade counts) */
  children: React.ReactNode;
  /** Group parlays are placed, not tailed */
  verb?: 'Tail' | 'Place it';
  canFade: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tailed = post.bets.some((b) => b.tailedByMe);
  const faded = post.fadedByMe;
  // Settled slips keep their tails and fades
  const live = post.bets.some((b) => b.result === 'PENDING');
  const onTail = (id: string) => onBack(id, 'tail');
  const picks = tailPicks(post);
  const book = post.sportsbook.name;
  const home = BOOK_HOMEPAGES[post.sportsbook.key] ?? null;
  const linked = picks.every((pk) => pk.link);
  // One click loads the whole bet: a straight's own link, or for parlays
  // (group ones too) and ladders one link carrying every leg, which FanDuel
  // loads onto one slip (a same-game parlay with its own price when parlay
  // legs share a game; a ladder's rungs land as singles, one per rung).
  const combined = combinedSlipLink(picks.map((p) => p.link));
  const oneClick = picks.length === 1 ? (picks[0].link ?? home) : combined;
  const single = !!oneClick;

  // Opens the book (or the pick list); `record` counts it as a tail
  const tailControl = (label: string, record: boolean) =>
    oneClick ? (
      <a
        href={oneClick}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => record && onTail(post.id)}
        className={tailButtonClass}
      >
        {label} ↗
      </a>
    ) : (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (record) onTail(post.id);
        }}
        className={tailButtonClass}
      >
        {label}
      </button>
    );

  let control: React.ReactNode;
  if (tailed)
    control = (
      <>
        {live && tailControl('Bet again', false)}
        <BackedBadge
          label={verb === 'Tail' ? 'Tailed' : 'Placed'}
          tone="tail"
          onUndo={live ? () => onBack(post.id, 'untail') : undefined}
        />
      </>
    );
  else if (faded)
    control = (
      <BackedBadge
        label="Faded"
        tone="fade"
        onUndo={live ? () => onBack(post.id, 'unfade') : undefined}
      />
    );
  else
    control = (
      <>
        {canFade && (
          <button
            type="button"
            onClick={() => onBack(post.id, 'fade')}
            title="Bet against it"
            className={fadeButtonClass}
          >
            Fade
          </button>
        )}
        {tailControl(verb, true)}
      </>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {children}
        <div className="ml-auto flex items-center gap-2">{control}</div>
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
  onBack,
  onReact,
  onMoveSeries,
  groupHandlers,
}: {
  post: FeedPost;
  currentUserId?: string;
  onSettle: (betId: string, result: BetResult) => void;
  onDelete: (postId: string) => void;
  onBack: (postId: string, action: BackAction) => void;
  onReact: (postId: string, emoji: ReactionEmoji) => void;
  onMoveSeries: (postId: string, seriesId: string | null) => void;
  groupHandlers: GroupHandlers;
}) {
  const isAuthor = post.author.id === currentUserId;
  const isGroup = post.type === 'GROUP_PARLAY';
  const locked = groupLocked(post);
  const tailCount = (
    <div className="flex items-center gap-3">
      <TailersButton
        postId={post.id}
        count={post.tailers.count}
        recent={post.tailers.recent}
      />
      {post.fadeCount > 0 && (
        <TailersButton postId={post.id} count={post.fadeCount} kind="fade" />
      )}
    </div>
  );
  const badges = slipBadges(post);
  const tier = slipTier(badges);
  const tierStyle = tier ? TIER_STYLES[tier] : null;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  // Ticks each minute so LIVE tags come and go on their own
  const now = useNow();
  // Long slips show the first few legs / rungs and a "View all" row
  const rungList = useLegPreview(post.bets, 'rungs');
  const legList = useLegPreview(post.bets[0].legs);
  useEffect(() => setCommentCount(post.commentCount), [post.commentCount]);
  // Others can tail while a bet is open; a tailed slip keeps its badge after.
  // A group parlay can be placed by anyone, creator included, once locked.
  const open = post.bets.some((b) => b.result === 'PENDING');
  const canTail =
    post.bets.some((b) => b.tailedByMe) ||
    post.fadedByMe ||
    (isGroup ? locked && open : !isAuthor && open);
  const first = post.bets[0];
  const isLadder = post.type === 'LADDER';
  const isStraight = post.type === 'STRAIGHT';
  const pick = first.legs[0];

  const rungsHit = post.bets.filter((b) => b.result === 'WON').length;
  const ladderSettled = post.bets.some((b) => b.result !== 'PENDING');
  // Every rung grades on the same stat
  const ladderActual =
    post.bets.find((b) => b.legs[0].actual != null)?.legs[0].actual ?? null;
  const allSettled = post.bets.every((b) => b.result !== 'PENDING');
  const ladderRisked = post.bets.reduce((s, b) => s + b.units, 0);
  const ladderReturn = post.bets.reduce(
    (s, b) => s + returned(b.units, b.decimalOdds, b.result),
    0
  );

  // A parlay's legs share the bet's result only once it has won; a lost
  // parlay doesn't say which leg missed, so those dots stay neutral.
  const legResult: BetResult = first.result === 'WON' ? 'WON' : 'PENDING';

  // Status chips. Settled: the result. Unsettled: LIVE while the game is on
  // (once for a one-game slip, per leg otherwise), PENDING only once the
  // game's over and the grade isn't in yet, nothing before kickoff.
  const singleGame = oneGame(post.bets.flatMap((b) => b.legs));
  const betChip = (bet: FeedPost['bets'][number]): React.ReactNode => {
    if (bet.result !== 'PENDING') return <ResultBadge result={bet.result} />;
    if (singleGame && isLive(bet.legs, now)) return <LiveBadge />;
    if (allFinal(bet.legs, now)) return <ResultBadge result="PENDING" />;
    return null;
  };
  // Picks posted after kickoff were made at live odds; that's tagged for good
  const inGameAt = (leg: FeedPost['bets'][number]['legs'][number]) =>
    inGameMinutes(leg.startsAt, post.createdAt);
  const inGameLegs = post.bets
    .flatMap((b) => b.legs)
    .map(inGameAt)
    .filter((m): m is number => m != null);
  const slipInGame = inGameLegs.length ? Math.max(...inGameLegs) : null;
  const legTag = (leg: FeedPost['bets'][number]['legs'][number]) => {
    const minutes = inGameAt(leg);
    const status = first.result === 'PENDING' ? legStatus(leg, now) : null;
    if (minutes == null && !status) return null;
    return (
      <>
        {minutes != null && <InGameBadge minutes={minutes} />}
        {status}
      </>
    );
  };
  const ladderLive =
    isLadder &&
    singleGame &&
    !allSettled &&
    isLive(
      post.bets.flatMap((b) => b.legs),
      now
    );

  // No overflow-hidden here: the tailer and reaction popovers open upward
  // past the card's edge
  return (
    <article
      // Scroll target for the side panels (slipAnchor in lib/scrollToSlip)
      id={`slip-${post.id}`}
      className={`rounded-2xl border bg-gray-900 ${
        tierStyle?.card ?? 'border-gray-800'
      }`}
    >
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link
          to={`/u/${post.author.username}`}
          aria-hidden="true"
          tabIndex={-1}
          className="flex-none"
        >
          <UserAvatar
            name={post.author.fullName}
            url={post.author.avatarUrl}
            className="h-10 w-10 text-base"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to={`/u/${post.author.username}`}
              className="truncate font-semibold leading-tight hover:underline"
            >
              {post.author.fullName}
            </Link>
            <StreakChip streak={post.author.streak} />
          </div>
          <p className="truncate text-sm text-gray-500">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <CrowdChip badges={badges} />
        {isAuthor && (
          <SlipMenu
            post={post}
            onSettle={onSettle}
            onMove={(seriesId) => onMoveSeries(post.id, seriesId)}
            onDelete={() => onDelete(post.id)}
          />
        )}
      </header>

      {post.series && (
        <div className="px-4 pt-3">
          <Link
            to={`/u/${post.author.username}/s/${post.series.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-gray-300 transition hover:border-emerald-500 hover:text-emerald-400"
          >
            <SeriesBadge
              emoji={post.series.emoji}
              color={post.series.color}
              className="h-5 w-5 rounded-full text-[11px]"
            />
            {post.series.name}
          </Link>
        </div>
      )}

      {post.caption && (
        <p className="whitespace-pre-wrap px-4 pt-3 text-gray-200">
          {post.caption}
        </p>
      )}

      <div
        className={`m-4 overflow-hidden rounded-xl border ${
          tierStyle?.slip ?? 'border-gray-800'
        }`}
      >
        <WinBanner badges={badges} ladder={post.type === 'LADDER'} />
        {isGroup ? (
          <GroupSlip post={post} handlers={groupHandlers} />
        ) : (
          <>
            {/* Title bar */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
              <div className="min-w-0">
                {isStraight && (
                  // A single pick is the slip's headline, like a book's bet receipt
                  <>
                    <p className="text-lg font-bold leading-tight">
                      {legText(pick).title}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {withFinal(legText(pick).market, pick.actual)}
                    </p>
                    <p className="mt-1.5 text-xs text-emerald-400">
                      {pick.eventLabel}
                    </p>
                  </>
                )}
                {isLadder && (
                  // The pick every rung climbs on is the headline
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {slipTitle(post)}
                    </p>
                    <p className="mt-0.5 text-lg font-bold leading-tight">
                      {pick.playerName ?? pick.selection}{' '}
                      <span className="font-semibold text-gray-400">
                        {pick.playerName
                          ? pick.marketLabel
                          : legText(pick).market}
                      </span>
                    </p>
                    {ladderActual != null && (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Final {ladderActual}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-emerald-400">
                      {pick.eventLabel}
                    </p>
                  </>
                )}
                {!isStraight && !isLadder && (
                  <p className="text-lg font-bold leading-tight">
                    {slipTitle(post)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded border border-gray-700 px-1.5 py-px text-[11px] font-semibold text-gray-400">
                    {post.sportsbook.name}
                  </span>
                  {slipInGame != null && <InGameBadge minutes={slipInGame} />}
                  {!isLadder && betChip(first)}
                  {ladderLive && <LiveBadge />}
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
                <ol>
                  {rungList.visible.map((bet, i) => {
                    const leg = bet.legs[0];
                    return (
                      <TimelineRow
                        key={bet.id}
                        result={bet.result}
                        last={i === rungList.visible.length - 1}
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
                          {/* The slip's LIVE tag covers rungs mid-game */}
                          {bet.result !== 'PENDING' || !ladderLive
                            ? betChip(bet)
                            : null}
                        </div>
                      </TimelineRow>
                    );
                  })}
                </ol>
                {rungList.toggle}
              </>
            ) : (
              !isStraight && (
                <>
                  <ol>
                    {legList.visible.map((leg, i) => (
                      <LegRow
                        key={leg.id}
                        leg={leg}
                        result={legResult}
                        last={i === legList.visible.length - 1}
                        // Multi-game parlays tag each open leg (settled bets
                        // don't need it) and each leg picked mid-game
                        tag={singleGame ? null : legTag(leg)}
                      />
                    ))}
                  </ol>
                  {legList.toggle}
                </>
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
                        {formatMoney(
                          returned(10, first.decimalOdds, first.result)
                        )}
                      </span>
                    }
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="space-y-3 px-4 pb-4 text-sm text-gray-500">
        {/* eslint-disable-next-line no-nested-ternary */}
        {isGroup && !locked ? (
          <GroupActions post={post} handlers={groupHandlers} />
        ) : canTail ? (
          <TailSection
            post={post}
            onBack={onBack}
            verb={isGroup ? 'Place it' : 'Tail'}
            canFade={!isAuthor && canBeFaded(post.type, first.legs)}
          >
            {tailCount}
          </TailSection>
        ) : (
          // Deleting lives in the author's ⋯ menu up top
          <div className="flex items-center">{tailCount}</div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-gray-800 pt-3">
          <ReactionBar
            reactions={post.reactions}
            onReact={(emoji) => onReact(post.id, emoji)}
          />
          <CommentsToggle
            count={commentCount}
            open={commentsOpen}
            onClick={() => setCommentsOpen((o) => !o)}
          />
        </div>
        {commentsOpen && (
          <Comments postId={post.id} onCount={setCommentCount} />
        )}
      </footer>
    </article>
  );
}
