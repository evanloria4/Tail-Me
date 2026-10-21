import React from 'react';

// Stand-ins for empty spots (nobody has bet yet): faded examples of
// what will show up, so an empty page still explains itself. Everything here
// is decorative and marked as an example.

/** Small "EXAMPLE" tag so nobody mistakes a placeholder for a real bet */
function ExampleTag() {
  return (
    <span className="rounded-md border border-dashed border-gray-700 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-gray-500">
      Example
    </span>
  );
}

/** A faded card frame with a stand-in poster, shaped like the real slip card */
function GhostFrame({
  caption,
  children,
}: {
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none rounded-2xl border border-dashed border-gray-800 bg-gray-900/60 opacity-70"
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 font-bold text-gray-500">
          ?
        </span>
        <div className="flex-1">
          <p className="font-semibold text-gray-300">A friend</p>
          <p className="text-sm text-gray-500">@yourfriend · just now</p>
        </div>
        <ExampleTag />
      </div>
      {caption && <p className="px-4 pt-3 text-gray-400">{caption}</p>}
      {children}
    </div>
  );
}

/** A timeline stop like the real slip's: hollow dot, line down to the next */
function GhostStop({
  last,
  children,
}: {
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative pl-10 pr-4">
      <span className="absolute left-4 top-4 h-3 w-3 rounded-full border-2 border-gray-600 bg-gray-900" />
      {!last && (
        <span className="absolute -bottom-4 left-[21.5px] top-7 w-px bg-gray-700" />
      )}
      <div className={`py-3 ${last ? '' : 'border-b border-gray-800'}`}>
        {children}
      </div>
    </li>
  );
}

/** A faded sample ladder: one prop, three climbing lines, each its own bet */
export function GhostLadder() {
  const rungs: [string, string, string][] = [
    ['Over 174.5', '-210', '1u'],
    ['Over 199.5', '+110', '0.5u'],
    ['Over 224.5', '+180', '0.25u'],
  ];
  return (
    <GhostFrame caption="Shough ladder. Every rung.">
      <div className="m-4 overflow-hidden rounded-xl border border-gray-800">
        <div className="border-b border-gray-800 px-4 py-3">
          <p className="text-lg font-bold leading-tight text-gray-300">
            3 Rung Ladder
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Tyler Shough - Passing Yards
          </p>
          <p className="mt-1 text-xs text-emerald-400/70">Falcons @ Saints</p>
        </div>
        <ol>
          {rungs.map(([pick, odds, stake], i) => (
            <GhostStop key={pick} last={i === rungs.length - 1}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-gray-300">{pick}</p>
                <span className="font-mono font-bold text-gray-300">
                  {odds}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{stake}</p>
            </GhostStop>
          ))}
        </ol>
      </div>
    </GhostFrame>
  );
}

/** A faded sample group parlay: one leg per friend, still taking legs */
export function GhostGroupParlay() {
  const legs: [string, string, string][] = [
    ['Ashton', 'Saints +3.5', 'Spread'],
    ['Michael', 'Over 47.5', 'Total'],
    ['Jack', 'Vikings ML', 'Moneyline'],
  ];
  return (
    <GhostFrame caption="Sunday group parlay. One leg each.">
      <div className="m-4 overflow-hidden rounded-xl border border-gray-800">
        <div className="border-b border-gray-800 px-4 py-3">
          <p className="text-lg font-bold leading-tight text-gray-300">
            👥 Group Parlay
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-400/70">
            🔒 Locks Sun 12:00 PM CT
          </p>
        </div>
        <ol>
          {legs.map(([who, pick, market], i) => (
            <GhostStop key={who} last={i === legs.length - 1}>
              <p className="font-bold text-gray-300">{pick}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {market}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-gray-400">
                {who}
              </p>
            </GhostStop>
          ))}
        </ol>
        <div className="border-t border-gray-800 px-4 py-3">
          <span className="block rounded-lg border border-dashed border-gray-700 py-2 text-center text-sm font-semibold text-gray-500">
            + Add your leg
          </span>
        </div>
      </div>
    </GhostFrame>
  );
}

/** A faded sample slip, shaped like the real card */
export function GhostSlip() {
  return (
    <GhostFrame>
      <div className="m-4 overflow-hidden rounded-xl border border-gray-800">
        <div className="flex items-start justify-between border-b border-gray-800 px-4 py-3">
          <div>
            <p className="text-lg font-bold leading-tight text-gray-300">
              New Orleans Saints -2.5
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Spread
            </p>
            <p className="mt-1.5 text-xs text-emerald-400/70">
              Falcons @ Saints
            </p>
          </div>
          <span className="font-mono text-lg font-bold text-gray-300">
            -110
          </span>
        </div>
        <div className="flex items-end justify-between bg-gray-950 px-4 py-3">
          <div>
            <p className="font-bold text-gray-300">1u</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Units
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-300">$19.09</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              $10 pays
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 pb-4 text-sm text-gray-500">
        <span>0 tails</span>
        <span className="rounded-lg border border-gray-700 px-3 py-1.5 font-semibold text-gray-500">
          Tail ↗
        </span>
      </div>
    </GhostFrame>
  );
}

/** Faded leaderboard-style rows: a dot, a name bar, a number bar */
export function GhostRows({ count = 3 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-gray-800 opacity-60">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-2.5 py-2">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gray-800 text-xs font-extrabold text-gray-500">
            {i + 1}
          </span>
          <span
            className="h-2.5 rounded-full bg-gray-800"
            style={{ width: `${48 - i * 10}%` }}
          />
          <span className="ml-auto h-2.5 w-10 rounded-full bg-gray-800" />
        </li>
      ))}
    </ul>
  );
}

/** One line under a placeholder saying what will appear there */
export function PlaceholderNote({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-xs text-gray-500">{children}</p>;
}
