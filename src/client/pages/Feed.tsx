import React from 'react';
import { useAuth } from '../auth/AuthProvider';
import PostList from '../components/PostList';
import { useLayout } from '../components/AppLayout';

export default function Feed() {
  const { isSubscribed } = useAuth();
  const { openComposer, feedVersion } = useLayout();

  return (
    <div className="mx-auto max-w-2xl">
      <PostList
        reloadKey={feedVersion}
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
    </div>
  );
}
