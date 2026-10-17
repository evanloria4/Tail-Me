import { z } from 'zod';
import type { PersonRef } from './social';
import type { StatLine, Streak } from './stats';

// Series: a named run of slips a user posts under (e.g. "CharLadder"), shown
// on their profile with its own record. Personal slips only, never group
// parlays. Built to be followed later (subscribe + notifications).

export const SERIES_NAME_MAX = 40;
export const SERIES_DESCRIPTION_MAX = 160;

export const seriesSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give it a name')
    .max(SERIES_NAME_MAX, `Names are ${SERIES_NAME_MAX} characters max`),
  description: z
    .string()
    .trim()
    .max(
      SERIES_DESCRIPTION_MAX,
      `Descriptions are ${SERIES_DESCRIPTION_MAX} characters max`
    )
    .optional(),
});

/** File a slip under a series, or take it out (null) */
export const postSeriesSchema = z.object({
  seriesId: z.string().min(1).max(64).nullable(),
});

/** What a slip card needs to link to its series */
export type SeriesRef = { id: string; name: string };

export type SeriesSummary = SeriesRef & {
  description: string | null;
  createdAt: string;
  /** Slips filed under it */
  slips: number;
  lastPostAt: string | null;
  /** Record over its settled bets (ladder rungs count one each) */
  line: StatLine;
  streak: Streak | null;
};

export type SeriesPage = SeriesSummary & {
  owner: PersonRef & { avatarUrl: string | null };
};
