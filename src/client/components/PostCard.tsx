import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatAmerican, formatMoney } from '../../shared/odds';
import {
  BetResult,
  canBeFaded,
  FeedPost,
  isSameGameLegs,
  isGooseEgg,
} from '../../shared/posts';
import timeAgo from '../lib/time';
import combinedSlipLink from '../../shared/betslip';
import useNow from '../lib/useNow';
import { netColor, signedUnits } from '../lib/statFormat';
import { betNet } from '../../shared/stats';
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
  GooseEggBanner,
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
  GameScore,
  ResultBadge,
  returned,
  slipTitle,
  TimelineRow,
  Total,
  units,
  withFinal,
  legStatBar,
  BetOdds,
  BookChip,
} from './SlipParts';
import {
  GroupActions,
  GroupHandlers,
  groupLocked,
  GroupSlip,
} from './GroupParlay';
import { SeriesBadge } from './SeriesCover';
import SlipMenu, { type RungInput } from './SlipMenu';
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

/** A settled ladder's bottom line: what it made, lost, or broke even */
const ladderNetLabel = (net: number) => {
  if (net > 0) return 'Profit';
  if (net < 0) return 'Loss';
  return 'Even';
};

export default function PostCard({
  post,
  currentUserId,
  isAdmin = false,
  onSettle,
  onDelete,
  onBack,
  onReact,
  onMoveSeries,
  onEdit,
  onOdds,
  onUnits,
  onBoost,
  onAddRung,
  onLockAt,
  groupHandlers,
}: {
  post: FeedPost;
  currentUserId?: string;
  /** Admins get the ⋯ menu on everyone's slips */
  isAdmin?: boolean;
  onSettle: (betId: string, result: BetResult) => void;
  onDelete: (postId: string) => void;
  onBack: (postId: string, action: BackAction) => void;
  onReact: (postId: string, emoji: ReactionEmoji) => void;
  onMoveSeries: (postId: string, seriesId: string | null) => void;
  /** Author opens the slip in the composer to change it */
  onEdit: (post: FeedPost) => void;
  /** Author sets a bet's real odds; resolves false if it didn't save */
  onOdds: (betId: string, americanOdds: number) => Promise<boolean>;
  /** Author changes a bet's stake; resolves false if it didn't save */
  onUnits: (betId: string, units: number) => Promise<boolean>;
  /** Author sets a bet's profit boost (0 removes it) */
  onBoost: (betId: string, boostPct: number) => Promise<boolean>;
  /** Author (pregame) or admin adds a ladder rung; false if it didn't save */
  onAddRung: (postId: string, rung: RungInput) => Promise<boolean>;
  /** Creator moves an open group parlay's deadline */
  onLockAt: (postId: string, iso: string) => Promise<boolean>;
  groupHandlers: GroupHandlers;
}) {
  const isAuthor = post.author.id === currentUserId;
  const isGroup = post.type === 'GROUP_PARLAY';
  const locked = groupLocked(post);
  // Once a tailed bet settles: what everyone who tailed made, if each bet the
  // poster's units (real stakes aren't known). Group parlays have no units.
  const tailedSettled = post.bets.filter(
    (b) => b.tailCount > 0 && b.result !== 'PENDING' && b.result !== 'VOID'
  );
  const tailerUnits = tailedSettled.reduce(
    (sum, b) => sum + b.tailCount * betNet(b),
    0
  );
  const tailCount = (
    <div className="flex items-center gap-3">
      <TailersButton
        postId={post.id}
        count={post.tailers.count}
        recent={post.tailers.recent}
      />
      {!isGroup && tailedSettled.length > 0 && (
        <span
          title="Everyone who tailed, if each bet the poster's units"
          className={`text-xs font-semibold tabular-nums ${netColor(tailerUnits)}`}
        >
          {signedUnits(tailerUnits)} for tailers
        </span>
      )}
      {post.fadeCount > 0 && (
        <TailersButton postId={post.id} count={post.fadeCount} kind="fade" />
      )}
    </div>
  );
  const badges = slipBadges(post);
  const tier = slipTier(badges);
  const tierStyle = tier ? TIER_STYLES[tier] : null;
  // Every leg missed (0 for N): a red card and the goose egg banner
  const goose =
    (post.type === 'PARLAY' || post.type === 'GROUP_PARLAY') &&
    isGooseEgg(post.bets[0].legs.map((l) => l.result));
  const gooseLegs = post.bets[0].legs.filter((l) => l.result !== 'VOID').length;
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
  const sgp = !isStraight && !isLadder && isSameGameLegs(first.legs);

  const rungsHit = post.bets.filter((b) => b.result === 'WON').length;
  const ladderSettled = post.bets.some((b) => b.result !== 'PENDING');
  // Every rung grades on the same stat, so a rung missing it borrows it
  const ladderStat = post.bets.find((b) => b.legs[0].actual != null)?.legs[0];
  // The rung in play: the lowest line still open that the stat hasn't
  // passed. Cleared rungs and the ones above it don't get a bar.
  const nextRungId = [...post.bets]
    .filter((b) => b.result === 'PENDING')
    .filter((b) => (b.legs[0].line ?? 0) > (ladderStat?.actual ?? 0))
    .sort((a, b) => (a.legs[0].line ?? 0) - (b.legs[0].line ?? 0))[0]?.id;
  const allSettled = post.bets.every((b) => b.result !== 'PENDING');
  const ladderRisked = post.bets.reduce((s, b) => s + b.units, 0);
  const ladderReturn = post.bets.reduce(
    (s, b) => s + returned(b.units, b.decimalOdds, b.result),
    0
  );
  // Rounded so float dust doesn't read as a tiny profit or loss
  const ladderNet = Math.round((ladderReturn - ladderRisked) * 100) / 100;

  // A parlay's legs share the bet's result only once it has won; a lost
  // parlay doesn't say which leg missed, so those dots stay neutral.
  const legResult: BetResult = first.result === 'WON' ? 'WON' : 'PENDING';

  // Status chips. Settled: the result. Unsettled: LIVE while the game is on
  // (once for a one-game slip, per leg otherwise), PENDING only once the
  // game's over and the grade isn't in yet, nothing before kickoff.
  const singleGame = oneGame(post.bets.flatMap((b) => b.legs));
  const betChip = (bet: FeedPost['bets'][number]): React.ReactNode => {
    if (bet.result !== 'PENDING') return <ResultBadge result={bet.result} />;
    // One game: the score in the header says it's live, else a LIVE chip
    if (singleGame && isLive(bet.legs, now)) {
      return pick.score ? null : <LiveBadge />;
    }
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
        tierStyle?.card ?? (goose ? 'border-red-400/40' : 'border-gray-800')
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
            color={post.author.avatarColor}
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
        {(isAuthor || isAdmin) && (
          <SlipMenu
            post={post}
            onSettle={onSettle}
            onSettleLeg={(legId, result) =>
              groupHandlers.settleLeg(post.id, legId, result)
            }
            onMove={(seriesId) => onMoveSeries(post.id, seriesId)}
            onDelete={() => onDelete(post.id)}
            onEdit={() => onEdit(post)}
            onOdds={onOdds}
            onUnits={onUnits}
            onBoost={onBoost}
            onAddRung={(rung) => onAddRung(post.id, rung)}
            onLockAt={(iso) => onLockAt(post.id, iso)}
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
          tierStyle?.slip ?? (goose ? 'border-red-400/40' : 'border-gray-800')
        }`}
      >
        <WinBanner badges={badges} ladder={post.type === 'LADDER'} />
        {goose && <GooseEggBanner legs={gooseLegs} />}
        {isGroup ? (
          <GroupSlip post={post} handlers={groupHandlers} />
        ) : (
          <>
            {/* Title bar */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
              <div className="min-w-0 flex-1">
                {isStraight && (
                  // A single pick is the slip's headline, like a book's bet receipt
                  <>
                    <p className="text-lg font-bold leading-tight">
                      {legText(pick).title}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {legStatBar(pick, now)
                        ? legText(pick).market
                        : withFinal(legText(pick).market, pick.actual)}
                    </p>
                    {legStatBar(pick, now)}
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
                      {pick.eventLabel}
                      <GameScore leg={pick} now={now} />
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
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
                      {pick.eventLabel}
                      <GameScore leg={pick} now={now} />
                    </p>
                  </>
                )}
                {!isStraight && !isLadder && (
                  <>
                    <p className="text-lg font-bold leading-tight">
                      {slipTitle(post)}
                    </p>
                    {/* An SGP names its game once here, not on every leg */}
                    {sgp && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-400">
                        {pick.eventLabel}
                        <GameScore leg={pick} now={now} />
                      </p>
                    )}
                  </>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <BookChip
                    bookKey={post.sportsbook.key}
                    name={post.sportsbook.name}
                  />
                  {slipInGame != null && <InGameBadge minutes={slipInGame} />}
                  {!isLadder && betChip(first)}
                  {ladderLive && !pick.score && <LiveBadge />}
                </div>
              </div>
              {!isLadder && <BetOdds bet={first} className="text-lg" />}
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
                    // Only the rung in play gets a bar; the rest just show
                    // their result
                    const bar =
                      bet.id === nextRungId &&
                      legStatBar(
                        {
                          ...leg,
                          actual: leg.actual ?? ladderStat?.actual ?? null,
                        },
                        now
                      );
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
                          <BetOdds bet={bet} />
                        </div>
                        {bar}
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
                        hideGame={sgp}
                        now={now}
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
                  {allSettled ? (
                    // Settled: what the ladder made or lost, not the return
                    <Total
                      align="right"
                      label={ladderNetLabel(ladderNet)}
                      value={
                        <span className={netColor(ladderNet)}>
                          {signedUnits(ladderNet)}
                        </span>
                      }
                    />
                  ) : (
                    // Until every rung settles, assume the open ones hit
                    <Total
                      align="right"
                      label="Max payout"
                      value={units(ladderReturn)}
                    />
                  )}
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
