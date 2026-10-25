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
const AUTO_GUESS_GAMES = 3;

/** A game without its odds, for import results */
const bare = ({ books, ...game }: OddsGame): ImportGame => game;

/**
 * Builds a slip from a pasted FanDuel link. Game lines match against the
 * leagues' cached games (no extra credits); props need their game's markets.
 * The first paste guesses up to AUTO_GUESS_GAMES games by market id; after
 * that the poster names games in `eventIds` (sent back with `searched`, so
 * earlier finds still count). Returns what matched and the games left.
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
    // eslint-disable-next-line no-restricted-syntax
    for (const id of asked) {
      if (done()) break;
      // eslint-disable-next-line no-await-in-loop
      await search(id);
    }

    // First paste: guess the props' games before asking, nearest ids first,
    // re-ranking after each one since a parlay can span games
    if (!asked.length) {
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
      `Slip import: ${picks.length}/${wantedKeys.size} picks, ${asked.length ? 'asked' : 'guessed'} ${searched.length} game(s)`
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
