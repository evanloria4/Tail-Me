import React, { useEffect, useRef, useState } from 'react';

// First-visit tour: a short card carousel over the less obvious features.
// Opens once per account (AppLayout checks profile.tutorialSeenAt) and can be
// reopened from the account menu. Each step pairs a few plain sentences with a
// small mock of the real UI so people recognize it later.

const chip = 'rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide';
const mockCard =
  'rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm shadow-sm';

function OddsChip({
  line,
  price,
  picked,
}: {
  line: string;
  price: string;
  picked?: boolean;
}) {
  return (
    <span
      className={`flex h-11 flex-1 flex-col items-center justify-center rounded-lg border text-xs ${
        picked
          ? 'border-emerald-500 bg-emerald-500 text-gray-950'
          : 'border-gray-800 bg-gray-950'
      }`}
    >
      <span className={picked ? 'opacity-80' : 'text-gray-400'}>{line}</span>
      <span className="font-bold tabular-nums">{price}</span>
    </span>
  );
}

type Step = {
  icon: string;
  title: string;
  body: React.ReactNode;
  visual: React.ReactNode;
};

const STEPS: Step[] = [
  {
    icon: '👋',
    title: 'Welcome to TailMe',
    body: 'One shared feed for your friends’ bets. Every slip shows the picks, the odds, and what $10 would pay.',
    visual: (
      <div className={mockCard}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
            J
          </span>
          <span className="font-semibold">Joe</span>
          <span className="text-xs text-gray-500">· 1h ago</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2">
          <span className="font-bold">3 Leg Parlay</span>
          <span className="font-mono font-bold">+521</span>
        </div>
      </div>
    ),
  },
  {
    icon: '🎯',
    title: 'Tail your friends',
    body: 'One click on Tail opens FanDuel with their whole bet on your slip, even parlays and same-game parlays. No rebuilding it leg by leg.',
    visual: (
      <div className="flex items-stretch gap-2">
        <div className={`${mockCard} flex flex-1 flex-col justify-between`}>
          <p className="font-bold">3 Leg Parlay</p>
          <span className="mt-2 self-start rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-gray-950">
            Tail ↗
          </span>
        </div>
        <span className="self-center text-lg font-bold text-emerald-400">
          →
        </span>
        <div className={`${mockCard} flex-1`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            FanDuel slip
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-400">
            ✓ 3 picks loaded
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: '📡',
    title: 'Post from live odds',
    body: 'Click the green + button, pick a league, and build slips like you would on a sportsbook. Make straight bets or parlays.',
    visual: (
      <div className={`${mockCard} space-y-2`}>
        <p className="truncate font-semibold">Seahawks @ Broncos</p>
        <div className="flex gap-1.5">
          <OddsChip line="-2.5" price="-115" />
          <OddsChip line="O 44.5" price="-110" picked />
          <OddsChip line="ML" price="-146" />
        </div>
      </div>
    ),
  },
  {
    icon: '🪜',
    title: 'Ladders',
    body: 'The same pick at climbing lines, each its own bet. Open a game, click a player’s “Alt lines / ladder”, then pick two or more lines on the same side.',
    visual: (
      <div className={`${mockCard} space-y-2`}>
        <p className="font-semibold">Bo Nix · Passing Yards</p>
        <div className="flex gap-1.5">
          <OddsChip line="O 174.5" price="-210" picked />
          <OddsChip line="O 199.5" price="+110" picked />
          <OddsChip line="O 224.5" price="+180" />
        </div>
      </div>
    ),
  },
  {
    icon: '👥',
    title: 'Group parlays',
    body: 'Everyone adds one leg to a shared parlay until it locks. Start one with + then “👥 Group parlay”. When it busts, everyone sees who busted the parlay.',
    visual: (
      <div className={`${mockCard} space-y-1.5`}>
        {[
          ['Ashton', 'Saints +3.5', true],
          ['Michael', 'Over 47.5', true],
          ['Jack', 'Vikings ML', false],
        ].map(([who, pick, hit]) => (
          <div key={who as string} className="flex items-center gap-2">
            <span className="w-16 font-semibold">{who}</span>
            <span className="flex-1 truncate text-gray-400">{pick}</span>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                hit
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              {hit ? '✓' : '✕'}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '📚',
    title: 'Series',
    body: 'Create a recurring bet, like a ladder you post every week. Add a slip to a series (or start a new one) when you review it, and the series keeps its own record on your profile.',
    visual: (
      <div className={`${mockCard} flex items-center justify-between`}>
        <span className="rounded-full border border-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
          📚 Ladder Szn
        </span>
        <span className="tabular-nums">
          7-3 <span className="font-semibold text-win">+4.2u</span>
        </span>
      </div>
    ),
  },
  {
    icon: '✅',
    title: 'No need to mark results',
    body: 'While a game is on, its bets show LIVE. When it ends, TailMe marks each bet won or lost for you. Player props also show the final number, like 278 passing yards. If a result looks wrong, fix it from the slip’s ⋯ menu.',
    visual: (
      <div className={`${mockCard} flex flex-wrap items-center gap-2`}>
        <span
          className={`${chip} inline-flex items-center gap-1 bg-red-500/15 text-red-400`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          LIVE
        </span>
        <span className={`${chip} bg-emerald-500/15 text-emerald-400`}>
          WON
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Passing Yards · Final 278
        </span>
      </div>
    ),
  },
];

export default function Tutorial({
  open,
  onDone,
}: {
  open: boolean;
  /** Finished or skipped; either way it's been seen */
  onDone: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      setStep(0);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <dialog
      ref={ref}
      aria-label="How TailMe works"
      // Escape skips the tour
      onCancel={(e) => {
        e.preventDefault();
        onDone();
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl border border-gray-800 bg-gray-950 p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {step + 1} of {STEPS.length}
            </span>
            {!last && (
              <button
                type="button"
                onClick={onDone}
                className="text-sm font-medium text-gray-400 hover:text-white"
              >
                Skip
              </button>
            )}
          </div>

          <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
            <span aria-hidden="true">{current.icon}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold">{current.title}</h2>
          <p className="mt-1.5 min-h-[4.5rem] text-sm leading-relaxed text-gray-400">
            {current.body}
          </p>

          <div className="mt-4" aria-hidden="true">
            {current.visual}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-700'
                  }`}
                />
              ))}
            </div>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onClick={() => (last ? onDone() : setStep(step + 1))}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400"
            >
              {last ? 'Let’s go' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
