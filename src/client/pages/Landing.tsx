import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

// What signed-out visitors see at "/". The slips are static mockups in the
// app's own card styles, so nothing here calls the API.

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
      <div className="flex items-center gap-3 px-4 pb-4 text-sm text-gray-500">
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
    <div className="w-56 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl shadow-black/30">
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
            <span className="ml-auto truncate text-gray-400">{pick}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-emerald-500 py-1.5 text-center text-sm font-semibold text-gray-950">
        + Add your leg
      </p>
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
    <div className="w-56 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl shadow-black/30">
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
    body: 'Tap real prices and lines to build a straight, parlay or ladder. No typing in odds, no fat-fingered lines.',
  },
  {
    icon: '🎯',
    title: 'Tail in one tap',
    body: 'See a pick you like? Tail drops it straight onto your sportsbook slip, already filled in.',
  },
  {
    icon: '👥',
    title: 'Group parlays',
    body: 'Everyone adds one leg before kickoff. When it busts, the whole crew knows exactly whose leg did it.',
  },
  {
    icon: '📈',
    title: 'Records that don’t lie',
    body: 'Units, ROI, streaks and a green/red calendar for the group. Everybody’s a sharp until the numbers come out.',
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
              <p className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 px-3 py-1 text-sm text-gray-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Invite-only, for your crew
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Bet with your crew.{' '}
                <span className="text-emerald-400">Tail the hot hand.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray-400">
                Post your slips from live odds, tail a friend&apos;s pick
                straight into your sportsbook, and finally settle who&apos;s
                actually cashing.
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
              {/* On wide screens the slip sits left so the cards can peek out
                  on its right, covering only its edge */}
              <div className="relative mx-auto max-w-sm xl:ml-4">
                <HeroSlip />
                <div className="absolute -right-40 top-6 hidden rotate-3 xl:block">
                  <LeaderCard />
                </div>
                <div className="absolute -bottom-44 -right-44 hidden -rotate-2 xl:block">
                  <GroupCard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-gray-800 bg-gray-900/40">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything the group chat does, minus the screenshots.
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-gray-400">
              One shared feed for the whole crew, with the receipts built in.
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
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your crew&apos;s already arguing about it.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-gray-400">
            Get the code from a friend and bring the receipts.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup" className={primaryCta}>
              Join with a code
            </Link>
            <Link to="/login" className={secondaryCta}>
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-800">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <Logo className="!text-xl" />
        </div>
      </footer>
    </div>
  );
}
