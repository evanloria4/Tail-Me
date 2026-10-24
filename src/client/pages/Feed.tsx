import React, { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import PostList from '../components/PostList';
import CommunitySidebar, {
  CommunityHighlights,
  CommunityTabs,
  useCommunityStats,
} from '../components/CommunitySidebar';
import { useLayout } from '../components/AppLayout';
import {
  GhostGroupParlay,
  GhostLadder,
  GhostSlip,
} from '../components/Placeholders';
import {
  GroupParlaysPanel,
  LiveNowPanel,
  useActiveSlips,
} from '../components/ActivePanels';
import { useToast } from '../components/Toast';
import useStickyTop from '../lib/useStickyTop';
import { PAGE_GRID, SIDE_COLUMN } from '../lib/layout';
import { FEED_FILTERS } from '../../shared/posts';
import type { FeedFilter } from '../../shared/posts';

const FILTER_LABELS: Record<FeedFilter, string> = {
  open: 'Open',
  live: 'Live',
  won: 'Won',
  lost: 'Lost',
  all: 'All',
};

/** What an empty filtered feed says */
const FILTER_EMPTY: Record<Exclude<FeedFilter, 'all'>, string> = {
  open: 'No open slips right now. Everything posted has settled.',
  live: 'Nothing live right now. Slips show up here while their games are on.',
  won: 'No winners yet.',
  lost: 'No losers yet. Enjoy it while it lasts.',
};

/** Underlined text tabs on a thin divider; five short labels fit any width */
function FilterTabs({
  value,
  onChange,
}: {
  value: FeedFilter;
  onChange: (f: FeedFilter) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter slips"
      // Fixed height: the side columns drop by exactly this row + the gap
      // (mt-12) so their tops line up with the first slip. No overflow
      // scrolling, so no stray scrollbar.
      className="flex h-8 items-stretch gap-5 border-b border-gray-800 sm:gap-6"
    >
      {FEED_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={value === f}
          onClick={() => onChange(f)}
          className={`-mb-px border-b-2 px-0.5 text-sm font-semibold transition ${
            value === f
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-gray-500 hover:text-white'
          }`}
        >
          {FILTER_LABELS[f]}
        </button>
      ))}
    </div>
  );
}

export default function Feed() {
  const { isSubscribed } = useAuth();
  const { openComposer, feedVersion } = useLayout();
  // Bumps when a result changes so the group stats' streaks and days catch up
  const [resultsVersion, setResultsVersion] = useState(0);
  const side = useStickyTop<HTMLElement>();
  const left = useStickyTop<HTMLElement>();
  const reloadKey = `${feedVersion}-${resultsVersion}`;
  const stats = useCommunityStats(reloadKey);
  const active = useActiveSlips(reloadKey);
  // The panels' posts, handed to the feed so its cards match them exactly
  const activePosts = useMemo(
    () => (active ? [...active.groups, ...active.live] : undefined),
    [active]
  );
  const toast = useToast();

  // Open slips first; the chips switch to live, settled or everything
  const [filter, setFilter] = useState<FeedFilter>('open');

  // A side-panel click: the feed scrolls to that slip, paging down if needed.
  // A slip outside the current filter (one that settled) is looked for again
  // under All.
  const [focusId, setFocusId] = useState<string | null>(null);
  const onFocusDone = useCallback(
    (found: boolean) => {
      if (!found && filter !== 'all') {
        setFilter('all');
        return;
      }
      setFocusId(null);
      if (!found) toast('That slip isn’t in the feed anymore');
    },
    [toast, filter]
  );

  // Slips centered, the sticky side column to their right (see lib/layout).
  // Wide screens: top earners, group parlays, who's hot and the calendar all
  // sit in the side column. Narrower: top earners, group record and calendar
  // are one tabbed card above the slips (one stats fetch feeds both). Extra-wide (xl): open/live group
  // parlays and live slips in a left column; below that, open group parlays
  // sit at the top of the feed when there are any.
  return (
    <div className={PAGE_GRID}>
      <div className="space-y-4 xl:col-start-2">
        {!!active?.groups.length && (
          <div className="xl:hidden">
            <GroupParlaysPanel posts={active.groups} onOpen={setFocusId} />
          </div>
        )}
        {/* Above the slips until the side column appears (lg) */}
        <div className="lg:hidden">
          <CommunityTabs stats={stats} />
        </div>
        <FilterTabs value={filter} onChange={setFilter} />
        <PostList
          status={filter}
          updates={activePosts}
          reloadKey={feedVersion}
          onChange={() => setResultsVersion((v) => v + 1)}
          focusId={focusId}
          onFocusDone={onFocusDone}
          empty={
            filter !== 'all' ? (
              <div className="rounded-2xl border border-dashed border-gray-800 p-6 text-center">
                <p className="text-sm text-gray-400">{FILTER_EMPTY[filter]}</p>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="mt-3 text-sm font-semibold text-emerald-400 hover:underline"
                >
                  See all slips
                </button>
              </div>
            ) : (
              // No slips yet: say what goes here and show one of each kind
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed border-gray-800 p-6 text-center">
                  <p className="font-semibold">
                    Your friends&apos; slips show up here
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                    Every bet anyone posts lands in this feed, ready to tail.
                    Here&apos;s what a straight bet, a ladder and a group parlay
                    look like.
                  </p>
                  {isSubscribed && (
                    <button
                      type="button"
                      onClick={() => openComposer()}
                      className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-gray-950 hover:bg-emerald-400"
                    >
                      Post the first bet
                    </button>
                  )}
                </div>
                <GhostSlip />
                <GhostLadder />
                <GhostGroupParlay />
              </div>
            )
          }
        />
      </div>
      <aside
        ref={left.ref}
        style={{ top: left.top }}
        className="side-column hidden xl:col-start-1 xl:row-start-1 xl:mt-12 xl:block xl:w-72 xl:justify-self-end"
      >
        <div className="space-y-3">
          <GroupParlaysPanel posts={active?.groups ?? []} onOpen={setFocusId} />
          <LiveNowPanel posts={active?.live ?? []} onOpen={setFocusId} />
        </div>
      </aside>
      <aside
        ref={side.ref}
        style={{ top: side.top }}
        className={`${SIDE_COLUMN} hidden lg:mt-12 lg:block`}
      >
        <div className="space-y-3">
          <CommunityHighlights stats={stats} stacked />
          <CommunitySidebar stats={stats} />
        </div>
      </aside>
    </div>
  );
}
