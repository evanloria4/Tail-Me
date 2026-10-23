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
import Logo from './Logo';
import UserAvatar from './UserAvatar';
import PostComposer from './PostComposer';
import type { JoinTarget, PostedKind } from './GroupReview';
import { useToast } from './Toast';
import Tutorial from './Tutorial';
import api from '../lib/api';

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

function Avatar({ name, url }: { name?: string; url?: string | null }) {
  return <UserAvatar name={name} url={url} className="h-10 w-10 text-base" />;
}

export function DarkModeSwitch({ className = '' }: { className?: string }) {
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
  /** Opens the slip builder; pass a group parlay to add your leg to it */
  openComposer: (join?: JoinTarget) => void;
  /** Bumps after each new post so the feed knows to reload */
  feedVersion: number;
  /** Replays the first-visit tour (Settings → Help) */
  openTour: () => void;
};

export const useLayout = () => useOutletContext<LayoutContext>();

export default function AppLayout() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  // First-visit tour: opens on its own until they finish or skip it, and
  // again from Settings → Help → Take the tour
  const [tourRequested, setTourRequested] = useState(false);
  const [tourDone, setTourDone] = useState(false);
  const tourOpen =
    tourRequested || (!!profile && !profile.tutorialSeenAt && !tourDone);
  const openTour = () => setTourRequested(true);
  const finishTour = () => {
    setTourRequested(false);
    setTourDone(true);
    if (profile && !profile.tutorialSeenAt) {
      api
        .post('/me/tutorial')
        .then(refreshProfile)
        .catch(() => {});
    }
  };
  const [composerOpen, setComposerOpen] = useState(false);
  const [join, setJoin] = useState<JoinTarget | null>(null);
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

  const openComposer = (target?: JoinTarget) => {
    setOpenMenu(null);
    setJoin(target ?? null);
    setComposerOpen(true);
  };
  const onPosted = (kind: PostedKind) => {
    setComposerOpen(false);
    setFeedVersion((v) => v + 1);
    // A new leg updates a slip already on screen; stay put
    if (kind === 'leg') {
      toast('Your leg is in');
      return;
    }
    navigate('/');
    toast(kind === 'group' ? 'Group parlay started' : 'Slip posted');
    // After the popup releases its scroll lock, jump to the new post at the top
    requestAnimationFrame(() =>
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header
        ref={headerRef}
        className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur"
      >
        <div className="flex h-16 items-center px-5 sm:px-8 lg:px-16 xl:px-24">
          <Logo />

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

            <div className="relative">
              <button
                type="button"
                onClick={() => toggle('user')}
                aria-expanded={openMenu === 'user'}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-gray-800"
              >
                <Avatar name={profile?.fullName} url={profile?.avatarUrl} />
                <ChevronIcon />
              </button>
              {openMenu === 'user' && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl"
                >
                  <Link
                    to={`/u/${profile?.username}`}
                    role="menuitem"
                    className="block border-b border-gray-800 px-4 py-3 transition hover:bg-gray-800"
                  >
                    <p className="truncate text-sm font-medium">
                      {profile?.fullName}
                    </p>
                    <p className="truncate text-sm text-gray-400">
                      @{profile?.username}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-400">
                      View profile
                    </p>
                  </Link>
                  <Link
                    to="/settings"
                    role="menuitem"
                    className="block px-4 py-2.5 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
                  >
                    Settings
                  </Link>
                  {profile?.isAdmin && (
                    <Link
                      to="/admin"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
                    >
                      Admin
                    </Link>
                  )}
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
              <NavLink to="/settings" className={mobileNavClass}>
                Settings
              </NavLink>
              {profile?.isAdmin && (
                <NavLink to="/admin" className={mobileNavClass}>
                  Admin
                </NavLink>
              )}
            </nav>
            <DarkModeSwitch className="mt-1 rounded-lg px-3 py-2.5 !text-base font-medium" />
            <div className="mt-3 flex items-center gap-3 border-t border-gray-800 pt-3 text-sm">
              {/* The account row doubles as the profile link */}
              <Link
                to={`/u/${profile?.username}`}
                aria-label="View your profile"
                className="-m-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition hover:bg-gray-900"
              >
                <Avatar name={profile?.fullName} url={profile?.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{profile?.fullName}</p>
                  <p className="truncate text-gray-400">@{profile?.username}</p>
                </div>
              </Link>
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
      {/* Pages set their own column widths (see lib/layout). Bottom
          padding keeps the floating button off the last card */}
      <main className="mx-auto max-w-screen-2xl px-4 pb-24 pt-6">
        <Outlet
          context={
            { openComposer, feedVersion, openTour } satisfies LayoutContext
          }
        />
      </main>
      {/* Floating new-bet button, bottom right on every screen size */}
      {!composerOpen && (
        <button
          type="button"
          onClick={() => openComposer()}
          aria-label="New bet"
          title="New bet"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-gray-950 shadow-lg shadow-black/30 transition hover:bg-emerald-400 active:scale-95 md:bottom-8 md:right-8"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
      <Tutorial open={tourOpen} onDone={finishTour} />
      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={onPosted}
        join={join}
      />
    </div>
  );
}
