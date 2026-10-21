import React, { useCallback, useState } from 'react';
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
  const toast = useToast();

  // A side-panel click: the feed scrolls to that slip, paging down if needed
  const [focusId, setFocusId] = useState<string | null>(null);
  const onFocusDone = useCallback(
    (found: boolean) => {
      setFocusId(null);
      if (!found) toast('That slip isn’t in the feed anymore');
    },
    [toast]
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
        <PostList
          reloadKey={feedVersion}
          onChange={() => setResultsVersion((v) => v + 1)}
          focusId={focusId}
          onFocusDone={onFocusDone}
          empty={
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
          }
        />
      </div>
      <aside
        ref={left.ref}
        style={{ top: left.top }}
        className="side-column hidden xl:col-start-1 xl:row-start-1 xl:block xl:w-72 xl:justify-self-end"
      >
        <div className="space-y-3">
          <GroupParlaysPanel posts={active?.groups ?? []} onOpen={setFocusId} />
          <LiveNowPanel posts={active?.live ?? []} onOpen={setFocusId} />
        </div>
      </aside>
      <aside
        ref={side.ref}
        style={{ top: side.top }}
        className={`${SIDE_COLUMN} hidden lg:block`}
      >
        <div className="space-y-3">
          <CommunityHighlights stats={stats} stacked />
          <CommunitySidebar stats={stats} />
        </div>
      </aside>
    </div>
  );
}
