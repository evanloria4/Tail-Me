import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { FREE_UNTIL, isPromoActive } from '../../shared/billing';
import { inSiteZone } from '../../shared/time';

// What signed-out visitors see at "/". The slips are static mockups in the
// app's own card styles, so nothing here calls the API.

const CONTACT_EMAIL = 'evan.loria4@gmail.com';

/** "October 31": the promo ends at midnight, so its last day is the one before */
const PROMO_LAST_DAY = new Date(FREE_UNTIL.getTime() - 1).toLocaleDateString(
  'en-US',
  inSiteZone({ month: 'long', day: 'numeric' })
);

const primaryCta =
  'inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-base font-semibold text-gray-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400';
const secondaryCta =
  'inline-flex items-center justify-center rounded-xl border border-gray-700 px-5 py-3 text-base font-semibold text-white transition hover:bg-gray-900';

// ---------- Mock slips ----------

function Avatar({ name, size = 'h-10 w-10' }: { name: string; size?: string }) {
  return (
    <span
      className={`flex ${size} flex-none items-center justify-center rounded-full bg-emerald-500/20 font-bold uppercase text-emerald-400`}
    >
      {name[0]}
    </span>
  );
}

function Leg({
  title,
  market,
  odds,
  game,
  last,
  hit,
}: {
  title: string;
  market: string;
  odds: string;
  game: string;
  last?: boolean;
  hit?: boolean;
}) {
  return (
    <li className="relative pl-10 pr-4">
      <span
        aria-hidden="true"
        className={`absolute left-4 top-4 h-3 w-3 rounded-full border-2 ${
          hit
            ? 'border-emerald-500 bg-emerald-500'
            : 'border-gray-600 bg-gray-900'
        }`}
      />
      {!last && (
        <span
          aria-hidden="true"
          className="absolute -bottom-4 left-[21.5px] top-7 w-px bg-gray-700"
        />
      )}
      <div className={`py-3 ${last ? '' : 'border-b border-gray-800'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold leading-snug">{title}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {market}
            </p>
          </div>
          <span className="font-mono font-bold tabular-nums">{odds}</span>
        </div>
        <p className="mt-1.5 text-xs text-emerald-400">{game}</p>
      </div>
    </li>
  );
}

/** The hero's slip: a hot poster's parlay that cashed */
function HeroSlip() {
  return (
    <div className="rounded-2xl border border-yellow-300/50 bg-gray-900 shadow-2xl shadow-black/30">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar name="Evan" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold leading-tight">Evan Loria</p>
            <span className="flex-none rounded-full bg-orange-400/15 px-2 py-0.5 text-xs font-bold text-orange-400">
              🔥 5 straight
            </span>
          </div>
          <p className="truncate text-sm text-gray-500">
            @papa_parlay · 2 hours ago
          </p>
        </div>
      </div>
      <p className="px-4 pt-3 text-gray-200">Told you. Pay the man.</p>
      <div className="m-4 overflow-hidden rounded-xl border border-yellow-300/40">
        <div className="border-b border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-sm font-bold text-yellow-300">
          💰 Cashed at +757
        </div>
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3">
          <div>
            <p className="text-lg font-bold leading-tight">3 Leg Parlay</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded border border-gray-700 px-1.5 py-px text-[11px] font-semibold text-gray-400">
                FanDuel
              </span>
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-400">
                WON
              </span>
            </div>
          </div>
          <span className="font-mono text-lg font-bold tabular-nums">+757</span>
        </div>
        <ol>
          <Leg
            hit
            title="Pittsburgh Steelers"
            market="Moneyline"
            odds="+130"
            game="Ravens @ Steelers"
          />
          <Leg
            hit
            title="Chicago Bears +3.5"
            market="Spread"
            odds="-110"
            game="Packers @ Bears"
          />
          <Leg
            hit
            last
            title="Under 44.5"
            market="Total"
            odds="-105"
            game="Jets @ Dolphins"
          />
        </ol>
        <div className="flex items-end justify-between border-t border-gray-800 bg-gray-950 px-4 py-3">
          <div>
            <p className="font-bold tabular-nums">0.5u</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Units
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold tabular-nums text-win">$85.70</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              $10 paid
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-4 pb-4 text-sm text-gray-500">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-400">
          ✓ Tailed
        </span>
        <span>with 8 others</span>
      </div>
    </div>
  );
}

/** Small floating cards around the hero slip */
function GroupCard() {
  return (
    <div className="w-44 rounded-2xl border border-gray-800 bg-gray-900 p-3 shadow-xl shadow-black/30 sm:w-56 sm:p-4">
      <p className="font-bold">👥 Group Parlay</p>
      <p className="mt-0.5 text-xs font-medium text-emerald-400">
        🔒 Locks Sun 1:00 PM CT
      </p>
      <p className="text-xs text-gray-500">🎯 Saints @ Falcons</p>
      <ul className="mt-3 space-y-2 text-sm">
        {[
          ['Ashton', 'Saints +3.5'],
          ['Michael', 'Over 47.5'],
          ['Jack', 'Saints ML'],
        ].map(([who, pick]) => (
          <li key={who} className="flex items-center gap-2">
            <Avatar name={who} size="h-6 w-6 text-[10px]" />
            <span className="font-semibold">{who}</span>
            <span className="ml-auto min-w-0 truncate text-gray-400">
              {pick}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-emerald-500 py-1.5 text-center text-sm font-semibold text-gray-950">
        + Add your leg
      </p>
    </div>
  );
}

/** Friend's parlay -> Tail -> the same legs loaded on your FanDuel slip */
function TailFlow() {
  const legs: [string, string][] = [
    ['Detroit Lions ML', '-150'],
    ['Eagles -6.5', '-110'],
    ['Over 47.5', '-105'],
  ];
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch"
    >
      <div className="w-full max-w-xs rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2">
          <Avatar name="Tony" size="h-7 w-7 text-xs" />
          <span className="text-sm font-semibold">Tony</span>
          <span className="text-xs text-gray-500">· 1h ago</span>
        </div>
        <div className="mt-3 rounded-xl border border-gray-800">
          <div className="flex justify-between border-b border-gray-800 px-3 py-2">
            <span className="font-bold">3 Leg Parlay</span>
            <span className="font-mono font-bold">+521</span>
          </div>
          <ul className="space-y-1.5 px-3 py-2 text-sm">
            {legs.map(([pick]) => (
              <li key={pick} className="text-gray-300">
                {pick}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex justify-end">
          <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-gray-950 shadow-lg shadow-emerald-500/30">
            Tail ↗
          </span>
        </div>
      </div>

      <div className="flex items-center text-2xl font-bold text-emerald-400">
        <span className="sm:hidden">↓</span>
        <span className="hidden sm:inline">→</span>
      </div>

      <div className="w-full max-w-xs rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Your FanDuel bet slip
        </p>
        <p className="mt-1 text-sm font-semibold text-emerald-400">
          ✓ 3 picks loaded
        </p>
        <ul className="mt-3 divide-y divide-gray-800 rounded-xl border border-gray-800 text-sm">
          {legs.map(([pick, odds]) => (
            <li key={pick} className="flex justify-between px-3 py-2">
              <span className="font-semibold">{pick}</span>
              <span className="font-mono text-gray-400">{odds}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between rounded-lg bg-gray-950 px-3 py-2 text-sm">
          <span className="font-semibold">Parlay</span>
          <span className="font-mono font-bold">+521</span>
        </div>
      </div>
    </div>
  );
}

function LeaderCard() {
  const rows: [string, string, string, string][] = [
    ['1', 'Evan', '+4.84u', 'bg-yellow-300'],
    ['2', 'Ligma', '+3.68u', 'bg-gray-300'],
    ['3', 'Your Mom', '+1.20u', 'bg-orange-400'],
  ];
  return (
    <div className="w-44 rounded-2xl border border-gray-800 bg-gray-900 p-3 shadow-xl shadow-black/30 sm:w-56 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Top earners this week
      </p>
      <ul className="mt-2 space-y-2 text-sm">
        {rows.map(([rank, who, units, color]) => (
          <li key={who} className="flex items-center gap-2.5">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-gray-950 ${color}`}
            >
              {rank}
            </span>
            <span className="font-medium">{who}</span>
            <span className="ml-auto font-semibold tabular-nums text-win">
              {units}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Sections ----------

const FEATURES: { icon: string; title: string; body: string }[] = [
  {
    icon: '📡',
    title: 'Post from live odds',
    body: 'Pick real prices and lines to build a straight, parlay or ladder. No typing in odds, no fat-fingered lines',
  },
  {
    icon: '🎯',
    title: 'Tail in one click',
    body: 'Click Tail on any bet, parlays and same-game parlays included, and FanDuel opens with the whole slip filled in',
  },
  {
    icon: '👥',
    title: 'Group parlays',
    body: 'Everyone adds one leg before kickoff. When it busts, everyone knows who busted the parlay',
  },
  {
    icon: '📈',
    title: 'Records that don’t lie',
    body: 'Units, ROI, streaks and a green/red calendar for the group. Everybody’s a sharp until the numbers come out',
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '1',
    title: 'Get the code',
    body: 'TailMe is invite-only, so grab the group code from a friend who’s already in',
  },
  {
    n: '2',
    title: 'Post or tail',
    body: 'Share your slips from live odds, or tail the hot hand into your own book',
  },
  {
    n: '3',
    title: 'Settle up',
    body: 'Mark your bets and watch everyone’s records move',
  },
];

function Feature({ icon, title, body }: (typeof FEATURES)[number]) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl"
      >
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-gray-400">{body}</p>
    </div>
  );
}

function Plan({
  name,
  price,
  note,
  items,
  featured,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        featured
          ? 'border-emerald-500 bg-emerald-500/5 shadow-xl shadow-emerald-500/10'
          : 'border-gray-800 bg-gray-900'
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        {name}
      </p>
      <p className="mt-2 text-4xl font-extrabold">
        {price}
        <span className="text-base font-medium text-gray-500">{note}</span>
      </p>
      <ul className="mt-5 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-gray-300">
            <span aria-hidden="true" className="font-bold text-emerald-400">
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-950 text-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
        <Logo />
        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-lg px-3 py-2 font-medium text-gray-300 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-gray-950 transition hover:bg-emerald-400"
          >
            Join
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[56rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-2 lg:pt-16 xl:pb-48">
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Bet with your friends.{' '}
                <span className="text-emerald-400">Tail the hot hand.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray-400">
                Post your slips from live odds, tail a friend&apos;s whole
                parlay onto your FanDuel slip in one click, and finally settle
                who&apos;s actually cashing.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className={primaryCta}>
                  Join with a code
                </Link>
                <Link to="/login" className={secondaryCta}>
                  Log in
                </Link>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Free to follow and tail. $5/month to post.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              {/* Tilted cards pin the slip's corners: top earners top-right,
                  the group parlay bottom-left (the slip's Tailed row sits
                  right so it stays visible). They hang further out as the
                  screen widens; the margins keep room for the overhang. */}
              <div className="relative mx-auto mb-24 mt-10 max-w-sm xl:mb-0">
                <HeroSlip />
                <div className="absolute -right-4 top-10 z-10 rotate-3 sm:-right-28 lg:-right-16 lg:-top-12 xl:-right-28 xl:top-10">
                  <LeaderCard />
                </div>
                <div className="absolute -bottom-20 left-0 z-10 -rotate-2 sm:-left-16 xl:-bottom-24 xl:-left-28">
                  <GroupCard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Spotlight: one-click tail */}
        <section className="border-t border-gray-800">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                One-click tail
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Tail the whole parlay. One click.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-gray-400">
                See a parlay you like? Click Tail and FanDuel opens with every
                leg already on your bet slip. Same-game parlays come through as
                one SGP at FanDuel&apos;s price. No rebuilding it leg by leg.
              </p>
            </div>
            <TailFlow />
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-800 bg-gray-900/40">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything the group chat does, minus the screenshots.
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-400">
              One shared feed for all your friends, with the receipts built in.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <Feature
                  key={f.title}
                  icon={f.icon}
                  title={f.title}
                  body={f.body}
                />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-gray-950">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-gray-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Pricing */}
        <section className="border-t border-gray-800 bg-gray-900/40">
          <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
            <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
              Cheaper than one bad leg
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Plan
                name="Free"
                price="$0"
                note=""
                items={[
                  'See every slip in the feed',
                  'Tail picks into your sportsbook',
                  'React, comment and trash talk',
                  'Place locked group parlays',
                ]}
              />
              <Plan
                featured
                name="Member"
                price="$5"
                note="/month"
                items={[
                  'Everything in Free',
                  'Post slips from live odds',
                  'Add your leg to group parlays',
                  'Start group parlays',
                ]}
              />
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-gray-500">
              {isPromoActive() &&
                `Member features are free for everyone through ${PROMO_LAST_DAY}. `}
              Membership renews monthly through Stripe until you cancel. Cancel
              anytime from Billing and you keep posting through the end of the
              month you paid for. Partial months aren’t refunded.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo className="!text-xl" />
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-gray-400 transition hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-gray-800 pt-6 text-xs leading-relaxed text-gray-500 sm:flex-row sm:justify-between sm:gap-10">
            <p className="max-w-lg">
              Tail-Me is a social app for sharing picks. It doesn’t take bets,
              hold money or pay out winnings; members bet on their own with
              licensed sportsbooks.
            </p>
            <p className="shrink-0 sm:text-right">
              21+ · Gambling problem? Call 1-800-GAMBLER
              <br />© {new Date().getFullYear()} Tail-Me
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
