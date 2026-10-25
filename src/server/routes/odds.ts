import { Router } from 'express';
import prisma from '../db';
import { requireAuth, requireSubscription } from '../middleware/auth';
import {
  getEventMarkets,
  getGames,
  OddsUnavailableError,
  runAsOddsCaller,
} from '../odds';
import {
  LIVE_ODDS_BOOK,
  OddsGame,
  OddsOutcome,
  pickerMarketKeys,
} from '../../shared/markets';
import {
  FanduelPick,
  ImportedPick,
  ImportGame,
  outcomePick,
  parseFanduelLink,
  pickKey,
  rankGamesByMarketId,
  slipImportSchema,
  SlipImportResult,
} from '../../shared/slipImport';
import { decodeShareCode, ShareLinkError } from '../fanduelShare';
import { eventSelections, fanduelEventId } from '../fanduelEvents';
import { MAX_GAME_MS } from '../../shared/live';

// Live odds for the bet picker. Every call can cost Odds API credits, so it's
// subscribers only and only whitelisted markets.
const router = Router();
router.use(requireAuth, requireSubscription);
// Fresh calls made while handling this request are charged to this person
router.use((req, _res, next) => runAsOddsCaller(req.user!.id, next));

async function isActiveSport(sportKey: string) {
  const sport = await prisma.sport.findFirst({
    where: { key: sportKey, active: true },
    select: { key: true },
  });
  return Boolean(sport);
}

function sendOddsError(res: import('express').Response, err: unknown) {
  if (err instanceof OddsUnavailableError) {
    res.status(503).json({ error: err.message });
    return;
  }
  throw err;
}

/** Games with spreads, totals and moneylines for every book */
router.get<{ sportKey: string }>('/:sportKey/games', async (req, res) => {
  if (!(await isActiveSport(req.params.sportKey))) {
    res.status(404).json({ error: 'Unknown sport' });
    return;
  }
  try {
    res.json(await getGames(req.params.sportKey));
  } catch (err) {
    sendOddsError(res, err);
  }
});

/** Player props / alt lines for one game: `?markets=player_pass_yds,...` */
router.get<{ sportKey: string; eventId: string }>(
  '/:sportKey/events/:eventId',
  async (req, res) => {
    const { sportKey, eventId } = req.params;
    const allowed = pickerMarketKeys(sportKey);
    const markets = String(req.query.markets ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (
      !markets.length ||
      markets.length > 8 ||
      markets.some((m) => !allowed.has(m))
    ) {
      res.status(400).json({ error: 'Unsupported markets' });
      return;
    }
    // Only games we've listed (and so stored) can be asked about
    const event = await prisma.event.findFirst({
      where: { id: eventId, sportKey },
      select: { id: true },
    });
    if (!event) {
      res.status(404).json({ error: 'Unknown game' });
      return;
    }
    try {
      res.json(await getEventMarkets(sportKey, eventId, markets));
    } catch (err) {
      sendOddsError(res, err);
    }
  }
);

/** Games whose props an import loads on its own before asking (~17 credits each) */
const AUTO_SEARCH_GAMES = 6;
/** Market-id guesses when FanDuel's game pages can't place the picks */
const AUTO_GUESS_GAMES = 3;
/** FanDuel game pages checked, nearest first (free; ~10 calls each, cached 10 min) */
const MAX_PAGE_CHECKS = 40;
/** Only games this close count as where a shared slip's props could be */
const LOOKAHEAD_MS = 4 * 24 * 60 * 60_000;

/** Every FanDuel selection id on a game's own lines (teams, Over / Under) */
const lineSelections = (g: OddsGame) =>
  Object.values(g.books[LIVE_ODDS_BOOK]?.markets ?? {}).flatMap((os) =>
    os.flatMap((o) => outcomePick(o)?.selectionId ?? [])
  );
const lineMarketIds = (g: OddsGame) =>
  Object.values(g.books[LIVE_ODDS_BOOK]?.markets ?? {}).flatMap((os) =>
    os.flatMap((o) => outcomePick(o)?.marketId ?? [])
  );

/**
 * The games unmatched picks are from, in the order to load them. A pick's
 * selection id is a team or a player and is the same in every FanDuel state
 * (market ids aren't), so: a team pick (alt spread, team total) matches the
 * team on a game's own lines; anything else (players, alt lines) is looked
 * up on FanDuel's game pages (free), nearest market ids first. A player is
 * in one game; a generic pick like "Over 21.5" can be in several, so those
 * try games the other legs point to first. The final match is still on the
 * exact market + selection ids, so a wrong guess just costs a load.
 */
export async function gamesForPicks(
  games: OddsGame[],
  missing: FanduelPick[],
  now: number
): Promise<string[]> {
  const order: string[] = [];
  const place = (id: string) => {
    if (!order.includes(id)) order.push(id);
  };
  let left = missing;

  const teamGame = new Map<string, string>();
  games.forEach((g) =>
    lineSelections(g).forEach((sid) => teamGame.set(sid, g.id))
  );
  left = left.filter((p) => {
    const id = teamGame.get(p.selectionId);
    if (id) place(id);
    return !id;
  });
  if (!left.length) return order;

  const upcoming = games.filter((g) => {
    const t = Date.parse(g.commenceTime);
    return t > now - MAX_GAME_MS && t < now + LOOKAHEAD_MS;
  });
  const ranked = rankGamesByMarketId(
    upcoming.map((g) => ({ id: g.id, marketIds: lineMarketIds(g) })),
    left
  );
  const candidates = [
    ...ranked,
    ...upcoming.map((g) => g.id).filter((id) => !ranked.includes(id)),
  ]
    .map((id) => ({
      id,
      fd: fanduelEventId(
        games.find((g) => g.id === id)?.books[LIVE_ODDS_BOOK]?.link
      ),
    }))
    .filter((c): c is { id: string; fd: string } => !!c.fd)
    .slice(0, MAX_PAGE_CHECKS);

  // Every candidate's page (cached, a few at a time): a player sits in one
  // game, but generic picks like "Over 21.5" can sit in several
  const hits = new Map<string, string[]>(left.map((p) => [pickKey(p), []]));
  for (let i = 0; i < candidates.length; i += 6) {
    const batch = candidates.slice(i, i + 6);
    // eslint-disable-next-line no-await-in-loop
    const sets = await Promise.all(batch.map((c) => eventSelections(c.fd)));
    batch.forEach((c, j) =>
      left.forEach((p) => {
        if (sets[j].has(p.selectionId)) hits.get(pickKey(p))!.push(c.id);
      })
    );
  }
  // Certain games first; then for ambiguous picks, games the other legs
  // already point to (most slips share games), else the nearest ids
  const lists = [...hits.values()];
  lists.filter((ids) => ids.length === 1).forEach(([id]) => place(id));
  lists
    .filter((ids) => ids.length > 1 && !ids.some((id) => order.includes(id)))
    .forEach((ids) => ids.forEach(place));
  return order;
}

/** A game without its odds, for import results */
const bare = ({ books, ...game }: OddsGame): ImportGame => game;

/**
 * Builds a slip from a pasted FanDuel link. Game lines match against the
 * leagues' cached games (no extra credits); props and alt lines need their
 * game's markets. The first paste finds those games (gamesForPicks: teams
 * from the game lines, players from FanDuel's game pages) and loads up to
 * AUTO_SEARCH_GAMES of them; only if that places nothing does it guess by
 * market id. After that the poster names games in `eventIds` (sent back with
 * `searched`, so earlier finds still count). Returns what matched and the
 * games left.
 */
router.post('/import', async (req, res) => {
  const parsed = slipImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message });
    return;
  }
  const link = parseFanduelLink(parsed.data.link);
  if (!link) {
    res
      .status(400)
      .json({ error: 'That doesn’t look like a FanDuel bet slip link' });
    return;
  }

  let wanted: FanduelPick[];
  try {
    wanted =
      link.kind === 'share'
        ? await decodeShareCode(link.shareCode)
        : link.picks;
  } catch (err) {
    if (err instanceof ShareLinkError) {
      res.status(422).json({ error: err.message });
      return;
    }
    throw err;
  }
  const wantedKeys = new Set(wanted.map(pickKey));

  try {
    const sports = await prisma.sport.findMany({
      where: { active: true },
      select: { key: true },
    });
    const games = (await Promise.all(sports.map((s) => getGames(s.key))))
      .flat()
      .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
    const byId = new Map(games.map((g) => [g.id, g]));

    const found = new Map<string, ImportedPick>();
    const collect = (
      game: OddsGame,
      markets: Record<string, OddsOutcome[]> = {}
    ) =>
      Object.entries(markets).forEach(([marketKey, outcomes]) =>
        outcomes.forEach((outcome) => {
          const pick = outcomePick(outcome);
          const key = pick && pickKey(pick);
          if (key && wantedKeys.has(key) && !found.has(key)) {
            found.set(key, { game: bare(game), marketKey, outcome });
          }
        })
      );

    games.forEach((g) => collect(g, g.books[LIVE_ODDS_BOOK]?.markets));
    const searched: string[] = [];
    const search = async (id: string) => {
      const game = byId.get(id)!;
      searched.push(id);
      const event = await getEventMarkets(game.sportKey, id, [
        ...pickerMarketKeys(game.sportKey),
      ]);
      collect(game, event.books[LIVE_ODDS_BOOK]?.markets);
    };
    const done = () => found.size === wantedKeys.size;

    const asked = parsed.data.eventIds.filter((id) => byId.has(id));
    // Dev only: skip finding games on its own, to preview the "tap the game"
    // step (SLIP_IMPORT_ASK=true in .env; production ignores it)
    const autoFind = !(
      process.env.NODE_ENV === 'development' &&
      process.env.SLIP_IMPORT_ASK === 'true'
    );
    // eslint-disable-next-line no-restricted-syntax
    for (const id of asked) {
      if (done()) break;
      // eslint-disable-next-line no-await-in-loop
      await search(id);
    }

    // First paste: find the props' games before asking (gamesForPicks), then
    // load just those. If FanDuel's pages can't place them, fall back to
    // guessing by market id, nearest first.
    if (autoFind && !asked.length) {
      const missingNow = wanted.filter((p) => !found.has(pickKey(p)));
      const targets = missingNow.length
        ? await gamesForPicks(games, missingNow, Date.now())
        : [];
      // eslint-disable-next-line no-restricted-syntax
      for (const id of targets) {
        if (done() || searched.length >= AUTO_SEARCH_GAMES) break;
        // eslint-disable-next-line no-await-in-loop
        await search(id);
      }
    }
    if (autoFind && !asked.length && !done() && !searched.length) {
      const idsOf = (g: OddsGame) =>
        Object.values(g.books[LIVE_ODDS_BOOK]?.markets ?? {}).flatMap((os) =>
          os.flatMap((o) => outcomePick(o)?.marketId ?? [])
        );
      const candidates = games.map((g) => ({ id: g.id, marketIds: idsOf(g) }));
      for (let i = 0; i < AUTO_GUESS_GAMES && !done(); i += 1) {
        const missing = wanted.filter((p) => !found.has(pickKey(p)));
        const next = rankGamesByMarketId(
          candidates.filter((c) => !searched.includes(c.id)),
          missing
        )[0];
        if (!next) break;
        // eslint-disable-next-line no-await-in-loop
        await search(next);
      }
    }

    const picks = [...wantedKeys].flatMap((k) => found.get(k) ?? []);
    // How often the market-id guess saves the "which game?" question
    console.info(
      `Slip import: ${picks.length}/${wantedKeys.size} picks, ${asked.length ? 'asked' : 'found'} ${searched.length} game(s)`
    );
    const result: SlipImportResult = {
      picks,
      total: wantedKeys.size,
      searched,
      games: done()
        ? []
        : games.filter((g) => !searched.includes(g.id)).map(bare),
    };
    res.json(result);
  } catch (err) {
    sendOddsError(res, err);
  }
});

export default router;
