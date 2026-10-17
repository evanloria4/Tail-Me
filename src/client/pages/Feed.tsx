import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import PostList from '../components/PostList';
import CommunitySidebar from '../components/CommunitySidebar';
import { useLayout } from '../components/AppLayout';

export default function Feed() {
  const { isSubscribed } = useAuth();
  const { openComposer, feedVersion } = useLayout();
  // Bumps when a result changes so the sidebar's streaks and days catch up
  const [resultsVersion, setResultsVersion] = useState(0);

  // Desktop: slips plus a sticky side column. Smaller screens: slips only.
  return (
    <div className="mx-auto max-w-2xl lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
      <PostList
        reloadKey={feedVersion}
        onChange={() => setResultsVersion((v) => v + 1)}
        empty={
          <div className="rounded-2xl border border-dashed border-gray-800 p-10 text-center">
            <p className="text-gray-400">No slips yet.</p>
            {isSubscribed && (
              <button
                type="button"
                onClick={openComposer}
                className="mt-4 inline-block rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-gray-950 hover:bg-emerald-400"
              >
                Post the first bet
              </button>
            )}
          </div>
        }
      />
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <CommunitySidebar reloadKey={`${feedVersion}-${resultsVersion}`} />
      </aside>
    </div>
  );
}
