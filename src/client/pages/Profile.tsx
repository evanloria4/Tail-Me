import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import api, { apiErrorMessage } from '../lib/api';
import useMeta from '../lib/useMeta';
import useStickyTop from '../lib/useStickyTop';
import useMediaQuery from '../lib/useMediaQuery';
import { inSiteZone } from '../../shared/time';
import { PAGE_GRID, SIDE_COLUMN } from '../lib/layout';
import {
  netColor,
  pct,
  record,
  settledCount,
  signedUnits,
  winPct,
} from '../lib/statFormat';
import { useLayout } from '../components/AppLayout';
import PostList from '../components/PostList';
import SeriesPanel from '../components/SeriesPanel';
import StatTile from '../components/StatTile';
import UserAvatar from '../components/UserAvatar';
import { FormDots, RangeTabs } from '../components/RecordParts';
import {
  POST_TYPES,
  PostType,
  SettledResult,
  STAT_RANGES,
  StatLine,
  StatRange,
  UserProfile,
} from '../../shared/stats';

// ---------- Formatting ----------

const EMPTY_LINE: StatLine = {
  wins: 0,
  losses: 0,
  pushes: 0,
  pending: 0,
  risked: 0,
  net: 0,
  roi: null,
};

const TYPE_LABELS: Record<PostType, string> = {
  STRAIGHT: 'Straights',
  PARLAY: 'Parlays',
  LADDER: 'Ladders',
};

// ---------- Pieces ----------

/** Dot beside a row: green up, red down, grey flat or unsettled */
const dotColor = (l: StatLine) => {
  if (!settledCount(l)) return 'bg-gray-700';
  if (l.net > 0) return 'bg-emerald-500';
  if (l.net < 0) return 'bg-red-400';
  return 'bg-gray-500';
};

/** One line per bet type / league: label, record, units */
function StatRow({ label, line }: { label: string; line: StatLine }) {
  const settled = settledCount(line) > 0;
  return (
    <li
      className="flex items-center gap-2.5 py-2 text-sm"
      title={
        settled
          ? `${pct(line.roi, true)} ROI · ${pct(winPct(line))} wins`
          : undefined
      }
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 flex-none rounded-full ${dotColor(line)}`}
      />
      <span
        className={`min-w-0 flex-1 truncate font-medium ${settled ? '' : 'text-gray-500'}`}
      >
        {label}
      </span>
      {settled ? (
        <>
          <span className="tabular-nums text-gray-400">{record(line)}</span>
          <span
            className={`w-16 text-right font-semibold tabular-nums ${netColor(line.net)}`}
          >
            {signedUnits(line.net)}
          </span>
        </>
      ) : (
        <span className="text-xs text-gray-500">
          {line.pending ? `${line.pending} pending` : '–'}
        </span>
      )}
    </li>
  );
}

function StatPanel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 px-4 pb-2 pt-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <ul className="divide-y divide-gray-800">{children}</ul>
      {note && <p className="pb-1 text-xs text-gray-500">{note}</p>}
    </section>
  );
}

function Form({ results }: { results: SettledResult[] }) {
  if (!results.length) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Last {results.length}
      </span>
      <FormDots results={results} />
    </div>
  );
}

// ---------- Page ----------

type BreakdownKey = 'series' | 'type' | 'league' | 'tailing';

export default function Profile() {
  const { username = '' } = useParams();
  const { profile: me } = useAuth();
  const { feedVersion } = useLayout();
  const meta = useMeta();
  const [range, setRange] = useState<StatRange>('all');
  const [data, setData] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const side = useStickyTop<HTMLElement>();
  // Matches PAGE_GRID's lg breakpoint, where the side column appears
  const wide = useMediaQuery('(min-width: 1024px)');
  const [panel, setPanel] = useState<BreakdownKey>('type');

  const load = useCallback(async () => {
    try {
      const { data: body } = await api.get<UserProfile>(
        `/users/${encodeURIComponent(username)}`,
        { params: { range } }
      );
      setData(body);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this profile'));
    }
  }, [username, range]);

  useEffect(() => {
    load();
  }, [load, feedVersion]);

  // Fresh page per user, not the last person's numbers
  useEffect(() => {
    setData(null);
    setRange('all');
  }, [username]);

  if (error && !data) {
    return (
      <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
        {error}
      </p>
    );
  }
  if (!data) return <p className="py-6 text-center text-gray-500">Loading…</p>;

  const { user, stats, tails, viewerTails } = data;
  const isMe = me?.id === user.id;
  const { overall, streak } = stats;
  const sportTitle = (key: string) =>
    meta?.sports.find((s) => s.key === key)?.title ?? key;
  const hasSettled = settledCount(overall) > 0;
  const joined = new Date(user.createdAt).toLocaleDateString(
    'en-US',
    inSiteZone({ month: 'short', year: 'numeric' })
  );
  // Multi-league parlays sit out of the league cards; say so when it shows
  const leagueBets = stats.bySport.reduce(
    (n, s) => n + settledCount(s.line) + s.line.pending,
    0
  );
  const hasMultiLeague = leagueBets < settledCount(overall) + overall.pending;
  // Every active league in a fixed order (empty ones included), then any
  // since-retired league they bet
  const leagueLines = new Map(stats.bySport.map((s) => [s.sportKey, s.line]));
  const leagueKeys = [
    ...new Set([
      ...(meta?.sports.map((s) => s.key) ?? []),
      ...leagueLines.keys(),
    ]),
  ];

  const panels: { key: BreakdownKey; label: string }[] = [
    { key: 'type', label: 'Bet type' },
    { key: 'series', label: 'Series' },
    ...(leagueKeys.length > 0
      ? [{ key: 'league' as const, label: 'League' }]
      : []),
    ...(settledCount(tails.line) > 0 || viewerTails
      ? [{ key: 'tailing' as const, label: 'Tailing' }]
      : []),
  ];
  // A tab can vanish (e.g. no tailing yet); fall back to the first
  const activePanel = panels.some((p) => p.key === panel)
    ? panel
    : panels[0].key;
  /** Desktop shows every available panel; smaller screens just the active one */
  const show = (key: BreakdownKey) =>
    panels.some((p) => p.key === key) && (wide || activePanel === key);

  let streakValue: React.ReactNode = '–';
  if (streak) {
    streakValue = (
      <span className={streak.kind === 'W' ? 'text-win' : 'text-red-400'}>
        {streak.kind === 'W' && streak.count >= 3 ? '🔥 ' : ''}
        {streak.kind}
        {streak.count}
      </span>
    );
  }

  // Desktop: two columns, breakdowns in a sticky side column next to the
  // slips. Smaller screens: one column, breakdowns between the tiles and slips.
  return (
    <div
      className={`${PAGE_GRID} lg:grid-rows-[auto_1fr] lg:gap-y-5 lg:space-y-0 space-y-5`}
    >
      <div className="space-y-5 lg:col-start-1 lg:row-start-1 xl:col-start-2">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          {/* Nothing here truncates: phones wrap, and the button gets its own row */}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <UserAvatar
              name={user.fullName}
              url={user.avatarUrl}
              color={user.avatarColor}
              className="h-16 w-16 text-2xl"
            />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-xl font-bold leading-tight">
                {user.fullName}
              </h1>
              <p className="flex flex-wrap gap-x-1 text-sm text-gray-500">
                <span className="break-all">@{user.username}</span>
                <span>· Joined {joined}</span>
              </p>
            </div>
            {/* Name and bio are edited in Settings */}
            {isMe && (
              <Link
                to="/settings"
                className="w-full flex-none rounded-lg border border-gray-700 px-3 py-1.5 text-center text-sm text-gray-300 hover:bg-gray-800 sm:w-auto"
              >
                Edit profile
              </Link>
            )}
          </div>
          {user.bio && (
            <p className="mt-3 whitespace-pre-wrap break-words text-gray-200">
              {user.bio}
            </p>
          )}
        </section>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RangeTabs value={range} onChange={setRange} />
            {overall.pending > 0 && (
              <span className="text-sm text-gray-500">
                {overall.pending} pending
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Record"
              value={hasSettled ? record(overall) : '–'}
              sub={
                hasSettled ? `${pct(winPct(overall))} wins` : 'No settled bets'
              }
            />
            <StatTile
              label="Units"
              value={
                <span className={netColor(overall.net)}>
                  {signedUnits(overall.net)}
                </span>
              }
              sub={`${pct(overall.roi, true)} ROI`}
            />
            <StatTile
              label="Streak"
              value={streakValue}
              sub={
                stats.bestWinStreak ? `Best W${stats.bestWinStreak}` : undefined
              }
            />
            <StatTile
              label="Tailed"
              value={tails.received}
              sub={`by ${tails.tailers} ${tails.tailers === 1 ? 'person' : 'people'}`}
            />
          </div>

          <Form results={stats.recent} />
        </div>
      </div>

      <aside
        ref={side.ref}
        style={{ top: side.top }}
        className={`${SIDE_COLUMN} grid content-start gap-3 lg:row-span-2 lg:row-start-1`}
      >
        {/* Below the desktop side column, one panel at a time behind tabs */}
        {!wide && (
          <div>
            <h2
              id="breakdown-heading"
              className="mb-2 text-sm font-semibold text-gray-300"
            >
              Breakdown
              {range !== 'all' && (
                <span className="font-normal text-gray-500">
                  {' '}
                  · {STAT_RANGES[range]}
                </span>
              )}
            </h2>
            <div
              role="tablist"
              aria-labelledby="breakdown-heading"
              className="flex overflow-x-auto rounded-lg border border-gray-800 bg-gray-900 p-0.5"
            >
              {panels.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === p.key}
                  onClick={() => setPanel(p.key)}
                  className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    activePanel === p.key
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {show('series') && (
          <SeriesPanel
            username={user.username}
            isOwner={isMe}
            reloadKey={feedVersion}
          />
        )}

        {show('type') && (
          <StatPanel title="By bet type">
            {POST_TYPES.map((t) => (
              <StatRow key={t} label={TYPE_LABELS[t]} line={stats.byType[t]} />
            ))}
          </StatPanel>
        )}

        {show('league') && (
          <StatPanel
            title="By league"
            note={
              hasMultiLeague
                ? 'Parlays that mix leagues only count overall.'
                : undefined
            }
          >
            {leagueKeys.map((key) => (
              <StatRow
                key={key}
                label={sportTitle(key)}
                line={leagueLines.get(key) ?? EMPTY_LINE}
              />
            ))}
          </StatPanel>
        )}

        {show('tailing') && (
          <StatPanel title="Tailing">
            <StatRow label="Tailed bets" line={tails.line} />
            {viewerTails && (
              <StatRow label="When you tail" line={viewerTails} />
            )}
          </StatPanel>
        )}
      </aside>

      <section className="lg:col-start-1 lg:row-start-2 xl:col-start-2">
        <h2 className="mb-2 text-sm font-semibold text-gray-300">
          Slips
          {range !== 'all' && (
            <span className="font-normal text-gray-500">
              {' '}
              · {STAT_RANGES[range]}
            </span>
          )}
        </h2>
        <PostList
          author={user.username}
          range={range}
          reloadKey={feedVersion}
          onChange={load}
          empty={
            <p className="rounded-2xl border border-dashed border-gray-800 p-8 text-center text-gray-400">
              {range !== 'all' &&
                `No slips in the ${STAT_RANGES[range].toLowerCase()}.`}
              {range === 'all' &&
                (isMe
                  ? 'Your slips show up here. Post one with the green + button.'
                  : 'No slips yet.')}
            </p>
          }
        />
      </section>
    </div>
  );
}
