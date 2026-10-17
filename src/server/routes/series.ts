import { Router } from 'express';
import prisma from '../db';
import { requireAuth, requireSubscription } from '../middleware/auth';
import { SeriesPage, seriesSchema, SeriesSummary } from '../../shared/series';
import {
  currentStreak,
  isPersonalType,
  StatBet,
  statLine,
} from '../../shared/stats';

// Series: GET /users/:username/series, GET /series/:id, and the owner's
// create / edit / delete. Mounted at /api.

const router = Router();

/** What a summary needs from each series */
const summarySelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  // Deleted slips still count toward the record, just not the slip count
  posts: {
    orderBy: { createdAt: 'desc' },
    select: {
      type: true,
      createdAt: true,
      deletedAt: true,
      bets: {
        select: { order: true, units: true, decimalOdds: true, result: true },
      },
    },
  },
} as const;

type SeriesRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  posts: {
    type: string;
    createdAt: Date;
    deletedAt: Date | null;
    bets: {
      order: number;
      units: { toNumber(): number };
      decimalOdds: { toNumber(): number };
      result: StatBet['result'];
    }[];
  }[];
};

function toSummary(row: SeriesRow): SeriesSummary {
  const visible = row.posts.filter((p) => !p.deletedAt);
  const bets: StatBet[] = row.posts.flatMap((p) => {
    const { type } = p;
    if (!isPersonalType(type)) return [];
    return p.bets.map((b) => ({
      type,
      sportKey: null,
      createdAt: p.createdAt,
      order: b.order,
      units: b.units.toNumber(),
      decimalOdds: b.decimalOdds.toNumber(),
      result: b.result,
    }));
  });
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    slips: visible.length,
    lastPostAt: visible[0]?.createdAt.toISOString() ?? null,
    line: statLine(bets),
    streak: currentStreak(bets),
  };
}

/** Someone's series, most recently posted to first */
router.get<{ username: string }>(
  '/users/:username/series',
  requireAuth,
  async (req, res) => {
    const owner = await prisma.user.findFirst({
      where: {
        username: { equals: req.params.username, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (!owner) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const rows = await prisma.series.findMany({
      where: { ownerId: owner.id },
      select: summarySelect,
    });
    const summaries = rows.map(toSummary);
    const recency = (s: SeriesSummary) => s.lastPostAt ?? s.createdAt;
    summaries.sort((a, b) => recency(b).localeCompare(recency(a)));
    res.json(summaries);
  }
);

/** One series with its owner */
router.get<{ id: string }>('/series/:id', requireAuth, async (req, res) => {
  const row = await prisma.series.findUnique({
    where: { id: req.params.id },
    select: {
      ...summarySelect,
      owner: {
        select: { id: true, username: true, fullName: true, avatarUrl: true },
      },
    },
  });
  if (!row) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  const body: SeriesPage = { ...toSummary(row), owner: row.owner };
  res.json(body);
});

/** Name taken by another of this owner's series (case doesn't matter) */
const nameTaken = async (ownerId: string, name: string, exceptId?: string) =>
  (await prisma.series.count({
    where: {
      ownerId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
  })) > 0;

/** Start a series. Posting needs a subscription, so this does too. */
router.post('/series', requireAuth, requireSubscription, async (req, res) => {
  const parsed = seriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? 'Invalid series' });
    return;
  }
  const ownerId = req.user!.id;
  const { name, description } = parsed.data;
  if (await nameTaken(ownerId, name)) {
    res.status(409).json({ error: `You already have a series called ${name}` });
    return;
  }
  const row = await prisma.series.create({
    data: { ownerId, name, description: description || null },
    select: summarySelect,
  });
  res.status(201).json(toSummary(row));
});

/** Rename or re-describe your own series */
router.patch<{ id: string }>('/series/:id', requireAuth, async (req, res) => {
  const parsed = seriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? 'Invalid series' });
    return;
  }
  const ownerId = req.user!.id;
  const existing = await prisma.series.findFirst({
    where: { id: req.params.id, ownerId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  const { name, description } = parsed.data;
  if (await nameTaken(ownerId, name, existing.id)) {
    res.status(409).json({ error: `You already have a series called ${name}` });
    return;
  }
  const row = await prisma.series.update({
    where: { id: existing.id },
    data: { name, description: description || null },
    select: summarySelect,
  });
  res.json(toSummary(row));
});

/** Delete your own series; its slips stay, just unfiled */
router.delete<{ id: string }>('/series/:id', requireAuth, async (req, res) => {
  const { count } = await prisma.series.deleteMany({
    where: { id: req.params.id, ownerId: req.user!.id },
  });
  if (!count) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  res.status(204).end();
});

export default router;
