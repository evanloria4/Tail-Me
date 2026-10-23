// Decodes FanDuel share links (`addToBetslip?shareCode=…`) into the picks they
// carry. This is the endpoint FanDuel's own site calls; it's unofficial and
// open without a login, so it can change or close at any time. Callers treat
// failure as "pick it by hand". Only the picks are kept (the response also
// names the sharer's FanDuel customer id, which we drop).
import axios from 'axios';
import { z } from 'zod';
import type { FanduelPick } from '../shared/slipImport';

const DECODE_URL =
  'https://api.sportsbook.fanduel.com/share-bet/decode-short-url/';
const TTL = 10 * 60_000;
const MAX_CACHED = 500;

export class ShareLinkError extends Error {}

const responseSchema = z.object({
  content: z
    .array(
      z.object({
        marketId: z.string().regex(/^[0-9.]{1,32}$/),
        selectionId: z.string().regex(/^[0-9.]{1,32}$/),
      })
    )
    .min(1)
    .max(50),
});

// Re-asking about the same code (picking games one at a time) stays local
const cache = new Map<string, { expires: number; picks: FanduelPick[] }>();

export async function decodeShareCode(code: string): Promise<FanduelPick[]> {
  const hit = cache.get(code);
  if (hit && hit.expires > Date.now()) return hit.picks;

  let data: unknown;
  try {
    ({ data } = await axios.get(DECODE_URL + encodeURIComponent(code), {
      timeout: 8_000,
      headers: { Accept: 'application/json' },
    }));
  } catch (err) {
    console.error(
      'FanDuel share decode failed',
      axios.isAxiosError(err) ? err.response?.status : err
    );
    throw new ShareLinkError(
      'Couldn’t read that FanDuel link. Pick the legs below instead.'
    );
  }
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ShareLinkError(
      'That FanDuel link has no picks we can read. Pick the legs below instead.'
    );
  }
  const picks = parsed.data.content.map(({ marketId, selectionId }) => ({
    marketId,
    selectionId,
  }));
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(code, { expires: Date.now() + TTL, picks });
  return picks;
}
