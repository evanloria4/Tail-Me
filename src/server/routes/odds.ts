import { Router } from 'express';
import prisma from '../db';
import { requireAuth, requireSubscription } from '../middleware/auth';
import { getEventMarkets, getGames, OddsUnavailableError } from '../odds';
import { pickerMarketKeys } from '../../shared/markets';

// Live odds for the bet picker. Every call can cost Odds API credits, so it's
// subscribers only and only whitelisted markets.
const router = Router();
router.use(requireAuth, requireSubscription);

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

export default router;
