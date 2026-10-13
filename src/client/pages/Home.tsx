import React from 'react';
import { useAuth } from '../auth/AuthProvider';

// Placeholder until the feed is built
export default function Home() {
  const { profile, isSubscribed, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <span className="text-xl font-bold">Tail Me</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-300">@{profile?.username}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-gray-700 px-3 py-1 hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-gray-400">
          Feed coming soon.{' '}
          {isSubscribed ? 'Subscribed ✅' : 'Free account (view + tail)'}
        </p>
      </main>
    </div>
  );
}
