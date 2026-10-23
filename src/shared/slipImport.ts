// Building a slip from a FanDuel link instead of picking every leg. FanDuel
// identifies a pick by marketId + selectionId, the same ids The Odds API puts
// in each outcome's add-to-betslip link, so pasted picks match live odds
// exactly. A share link ("Share" in the app) carries only a shareCode, which
// the server decodes into those pairs (server/fanduelShare.ts).
import { z } from 'zod';
import type { OddsGame, OddsOutcome } from './markets';

/** One FanDuel pick */
export type FanduelPick = { marketId: string; selectionId: string };

/** What a pasted link holds: the picks themselves, or a code to decode */
export type FanduelLink =
  | { kind: 'picks'; picks: FanduelPick[] }
  | { kind: 'share'; shareCode: string };

const FANDUEL_HOST = /(^|\.)sportsbook\.fanduel\.com$/;
const SHARE_CODE = /^[A-Za-z0-9_-]{4,32}$/;
const ID = /^[0-9.]{1,32}$/;

/**
 * Reads a pasted FanDuel link. Takes share links
 * (`addToBetslip?shareCode=…`) and add-to-betslip links, single
 * (`marketId=…&selectionId=…`) or indexed (`marketId[0]=…`). Returns null
 * for anything else. Text around the link (share messages) is ignored.
 */
export function parseFanduelLink(text: string): FanduelLink | null {
  const found = text.match(/https?:\/\/[^\s"'<>]+/);
  if (!found) return null;
  let url: URL;
  try {
    url = new URL(found[0]);
  } catch {
    return null;
  }
  if (!FANDUEL_HOST.test(url.hostname)) return null;
  const q = url.searchParams;

  const shareCode = q.get('shareCode');
  if (shareCode) {
    return SHARE_CODE.test(shareCode) ? { kind: 'share', shareCode } : null;
  }

  const picks: FanduelPick[] = [];
  const single = [q.get('marketId'), q.get('selectionId')];
  if (single[0] && single[1]) {
    picks.push({ marketId: single[0], selectionId: single[1] });
  }
  for (let i = 0; i < 50; i += 1) {
    const marketId = q.get(`marketId[${i}]`);
    const selectionId = q.get(`selectionId[${i}]`);
    if (!marketId || !selectionId) break;
    picks.push({ marketId, selectionId });
  }
  const valid = picks.filter(
    (p) => ID.test(p.marketId) && ID.test(p.selectionId)
  );
  return valid.length ? { kind: 'picks', picks: valid } : null;
}

/** The FanDuel pick behind a live-odds outcome (its add-to-betslip link) */
export function outcomePick(o: OddsOutcome): FanduelPick | null {
  if (!o.link) return null;
  try {
    const q = new URL(o.link).searchParams;
    const marketId = q.get('marketId');
    const selectionId = q.get('selectionId') ?? o.sid;
    return marketId && selectionId ? { marketId, selectionId } : null;
  } catch {
    return null;
  }
}

export const pickKey = (p: FanduelPick) => `${p.marketId}:${p.selectionId}`;

export const slipImportSchema = z.object({
  link: z.string().trim().min(1, 'Paste a FanDuel link').max(2000),
  /** Games the poster said the unmatched picks are from */
  eventIds: z.array(z.string().min(1).max(64)).max(20).default([]),
});
export type SlipImportInput = z.input<typeof slipImportSchema>;

export type ImportGame = Omit<OddsGame, 'books'>;

export type ImportedPick = {
  game: ImportGame;
  marketKey: string;
  outcome: OddsOutcome;
};

export type SlipImportResult = {
  /** Matched picks, in the shared slip's order */
  picks: ImportedPick[];
  /** Picks on the shared slip */
  total: number;
  /** Games whose props were loaded; send back as `eventIds` next time */
  searched: string[];
  /** Games the unmatched picks could be from (not yet searched), by start */
  games: ImportGame[];
};

/** "42.617516464" -> 617516464; FanDuel numbers markets roughly in order */
function marketNumber(marketId: string): number | null {
  const n = Number(marketId.split('.')[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Games ordered by how close their FanDuel market ids sit to the picks'
 * (FanDuel appears to create a game's markets together). A guess, used to
 * pick which games' props to load first; games without ids are left out.
 */
export function rankGamesByMarketId(
  games: { id: string; marketIds: string[] }[],
  picks: FanduelPick[]
): string[] {
  const targets = picks.flatMap((p) => marketNumber(p.marketId) ?? []);
  if (!targets.length) return [];
  return games
    .flatMap((g) => {
      const own = g.marketIds.flatMap((m) => marketNumber(m) ?? []);
      if (!own.length) return [];
      const gap = Math.min(
        ...own.flatMap((a) => targets.map((t) => Math.abs(a - t)))
      );
      return [{ id: g.id, gap }];
    })
    .sort((a, b) => a.gap - b.gap)
    .map((g) => g.id);
}
