import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
  }`;

export default function AppLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            Tail<span className="text-emerald-400">Me</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Feed
            </NavLink>
            <NavLink to="/new" className={navClass}>
              + Post
            </NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-gray-400 sm:inline">
              @{profile?.username}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
