import React, { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import useTheme from '../lib/theme';
import PostComposer from './PostComposer';

const NAV_ITEMS = [{ to: '/', label: 'Feed', end: true }];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-base font-medium transition ${
    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
  }`;

const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2.5 text-base font-medium transition ${
    isActive
      ? 'bg-gray-800 text-white'
      : 'text-gray-300 hover:bg-gray-900 hover:text-white'
  }`;

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 text-gray-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

function Avatar({ name }: { name?: string }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-base font-bold uppercase text-emerald-400">
      {name?.[0] ?? '?'}
    </span>
  );
}

function DarkModeSwitch({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const on = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggleTheme}
      className={`flex w-full items-center justify-between text-left text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white ${className}`}
    >
      Dark mode
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition ${
          on ? 'bg-emerald-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

type OpenMenu = 'mobile' | 'user' | null;

export type LayoutContext = {
  openComposer: () => void;
  /** Bumps after each new post so the feed knows to reload */
  feedVersion: number;
};

export const useLayout = () => useOutletContext<LayoutContext>();

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feedVersion, setFeedVersion] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  const toggle = (menu: Exclude<OpenMenu, null>) =>
    setOpenMenu((current) => (current === menu ? null : menu));

  // Close menus on navigation, Escape, or a click outside the header.
  useEffect(() => setOpenMenu(null), [pathname]);
  useEffect(() => {
    if (!openMenu) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenu(null);
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [openMenu]);

  const openComposer = () => {
    setOpenMenu(null);
    setComposerOpen(true);
  };
  const onPosted = () => {
    setComposerOpen(false);
    setFeedVersion((v) => v + 1);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header
        ref={headerRef}
        className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur"
      >
        <div className="flex h-16 items-center px-5 sm:px-8 lg:px-16 xl:px-24">
          <Link
            to="/"
            // Light mode sets the dark-mode wordmark in a dark chip; the
            // literal colors keep it identical in both themes
            className="rounded-lg bg-[#111827] px-3 pb-1.5 pt-1 text-2xl font-extrabold tracking-tight text-[#fff] sm:text-3xl dark:bg-transparent dark:p-0"
          >
            Tail<span className="text-[#34d399]">Me</span>
          </Link>

          <div className="ml-auto hidden items-center gap-8 md:flex">
            <nav className="flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={openComposer}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-semibold text-gray-950 transition hover:bg-emerald-400"
            >
              + Post
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => toggle('user')}
                aria-expanded={openMenu === 'user'}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-gray-800"
              >
                <Avatar name={profile?.fullName} />
                <ChevronIcon />
              </button>
              {openMenu === 'user' && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl"
                >
                  <div className="border-b border-gray-800 px-4 py-3">
                    <p className="truncate text-sm font-medium">
                      {profile?.fullName}
                    </p>
                    <p className="truncate text-sm text-gray-400">
                      @{profile?.username}
                    </p>
                  </div>
                  <DarkModeSwitch className="px-4 py-2.5" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                    className="block w-full border-t border-gray-800 px-4 py-2.5 text-left text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => toggle('mobile')}
            aria-expanded={openMenu === 'mobile'}
            aria-controls="mobile-menu"
            aria-label={openMenu === 'mobile' ? 'Close menu' : 'Open menu'}
            className="ml-auto rounded-lg p-2 text-gray-300 transition hover:bg-gray-800 hover:text-white md:hidden"
          >
            <MenuIcon open={openMenu === 'mobile'} />
          </button>
        </div>

        {openMenu === 'mobile' && (
          <div
            id="mobile-menu"
            className="border-t border-gray-800 px-5 pb-4 pt-2 sm:px-8 md:hidden"
          >
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={mobileNavClass}
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={openComposer}
                className={`w-full text-left ${mobileNavClass({ isActive: false })}`}
              >
                + Post
              </button>
            </nav>
            <DarkModeSwitch className="mt-1 rounded-lg px-3 py-2.5 !text-base font-medium" />
            <div className="mt-3 flex items-center gap-3 border-t border-gray-800 pt-3 text-sm">
              <Avatar name={profile?.fullName} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{profile?.fullName}</p>
                <p className="truncate text-gray-400">@{profile?.username}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-gray-700 px-3 py-1.5 text-gray-300 transition hover:bg-gray-800"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet
          context={{ openComposer, feedVersion } satisfies LayoutContext}
        />
      </main>
      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={onPosted}
      />
    </div>
  );
}
