// Bet-picker slip logic: what the picked outcomes add up to (straight, parlay
// or ladder) and how they turn into a post. Kept free of React so it's testable.
import type { OddsOutcome } from '../../shared/markets';
import { parlayDecimal } from '../../shared/odds';
import type { CreatePostInput, LegInput } from '../../shared/posts';

export type Selection = {
  key: string;
  sportKey: string;
  eventId: string;
  /** "Away @ Home" */
  eventLabel: string;
  /** Odds API market key, alternates included */
  marketKey: string;
  marketLabel: string;
  outcome: OddsOutcome;
  /** Game start, ISO; a group parlay's default deadline */
  commenceTime?: string;
};

export type SlipMode = 'STRAIGHT' | 'PARLAY' | 'LADDER';

export const selectionKey = (
  eventId: string,
  marketKey: string,
  o: OddsOutcome
) => [eventId, marketKey, o.player ?? '', o.name, o.point ?? ''].join('|');

/** "player_pass_yds_alternate" -> "player_pass_yds", "alternate_spreads" -> "spreads" */
export const baseMarket = (key: string) =>
  key.replace(/_alternate$/, '').replace(/^alternate_/, '');

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** How a pick reads on the slip, e.g. "Bo Nix Over 197.5" */
export function selectionTitle(s: Selection): string {
  const { name, player, point } = s.outcome;
  const base = baseMarket(s.marketKey);
  if (base === 'h2h') return name;
  if (base === 'spreads') return `${name} ${signed(point ?? 0)}`;
  if (base === 'totals') return `${name} ${point}`;
  if (name === 'Yes') return `${player} ${s.marketLabel}`;
  return `${player} ${name}${point != null ? ` ${point}` : ''}`;
}

/** Same player/team, same market, same side, different lines */
export function canLadder(sels: Selection[]): boolean {
  if (sels.length < 2) return false;
  const [first] = sels;
  const sameShape = sels.every(
    (s) =>
      s.eventId === first.eventId &&
      baseMarket(s.marketKey) === baseMarket(first.marketKey) &&
      s.outcome.player === first.outcome.player &&
      s.outcome.name === first.outcome.name &&
      s.outcome.point != null
  );
  const points = new Set(sels.map((s) => s.outcome.point));
  return sameShape && points.size === sels.length;
}

export const isSameGame = (sels: Selection[]) =>
  sels.length > 1 && sels.every((s) => s.eventId === sels[0].eventId);

/** Combined decimal odds the slip pays at, before any book SGP price */
export function slipDecimal(sels: Selection[]): number | null {
  if (!sels.length) return null;
  return parlayDecimal(sels.map((s) => s.outcome.price));
}

/** One picked outcome as a leg (also a group parlay leg on its own) */
export function toLeg(s: Selection): LegInput {
  const base = baseMarket(s.marketKey);
  const marketKey =
    base === 'h2h' || base === 'spreads' || base === 'totals'
      ? base
      : 'player_prop';
  const { outcome: o } = s;
  return {
    sportKey: s.sportKey,
    eventId: s.eventId,
    eventLabel: s.eventLabel,
    marketKey,
    ...(marketKey === 'player_prop'
      ? { marketLabel: s.marketLabel, playerName: o.player }
      : {}),
    selection: o.name,
    line: marketKey === 'h2h' ? null : (o.point ?? null),
    americanOdds: o.price,
    ...(o.sid ? { bookSelectionId: o.sid } : {}),
    ...(o.link ? { deepLink: o.link } : {}),
  };
}

export function buildPost(opts: {
  mode: SlipMode;
  selections: Selection[];
  sportsbookKey: string;
  units: number;
  /** Ladder stakes by selection key */
  rungUnits: Record<string, number>;
  slipOdds?: number;
  caption?: string;
  /** One of the poster's series, or null for none */
  seriesId?: string | null;
}): CreatePostInput {
  const { mode, selections, sportsbookKey } = opts;
  const base = {
    sportsbookKey,
    caption: opts.caption || undefined,
    seriesId: opts.seriesId ?? undefined,
  };
  if (mode === 'STRAIGHT') {
    return {
      ...base,
      type: 'STRAIGHT',
      units: opts.units,
      leg: toLeg(selections[0]),
    };
  }
  if (mode === 'PARLAY') {
    return {
      ...base,
      type: 'PARLAY',
      units: opts.units,
      legs: selections.map(toLeg),
      slipOdds: opts.slipOdds,
    };
  }
  // Ladder: one pick, rungs climbing in line
  const rungs = [...selections].sort(
    (a, b) => (a.outcome.point ?? 0) - (b.outcome.point ?? 0)
  );
  const { line, americanOdds, bookSelectionId, deepLink, ...pick } = toLeg(
    rungs[0]
  );
  return {
    ...base,
    type: 'LADDER',
    pick,
    rungs: rungs.map((s) => ({
      line: s.outcome.point as number,
      americanOdds: s.outcome.price,
      units: opts.rungUnits[s.key] ?? 1,
      ...(s.outcome.sid ? { bookSelectionId: s.outcome.sid } : {}),
      ...(s.outcome.link ? { deepLink: s.outcome.link } : {}),
    })),
  };
}
