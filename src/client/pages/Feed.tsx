import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import PostList from '../components/PostList';
import CommunitySidebar from '../components/CommunitySidebar';
import { useLayout } from '../components/AppLayout';
import useStickyTop from '../lib/useStickyTop';
import { PAGE_GRID, SIDE_COLUMN } from '../lib/layout';

export default function Feed() {
  const { isSubscribed } = useAuth();
  const { openComposer, feedVersion } = useLayout();
  // Bumps when a result changes so the sidebar's streaks and days catch up
  const [resultsVersion, setResultsVersion] = useState(0);
  const side = useStickyTop<HTMLElement>();

  // Slips centered, the sticky side column to their right (see lib/layout).
  // Smaller screens: slips only.
  return (
    <div className={PAGE_GRID}>
      <div className="xl:col-start-2">
        <PostList
          reloadKey={feedVersion}
          onChange={() => setResultsVersion((v) => v + 1)}
          empty={
            <div className="rounded-2xl border border-dashed border-gray-800 p-10 text-center">
              <p className="text-gray-400">No slips yet.</p>
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
          }
        />
      </div>
      <aside
        ref={side.ref}
        style={{ top: side.top }}
        className={`${SIDE_COLUMN} hidden lg:block`}
      >
        <CommunitySidebar reloadKey={`${feedVersion}-${resultsVersion}`} />
      </aside>
    </div>
  );
}
