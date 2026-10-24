import { describe, expect, it } from 'vitest';
import type { FeedPost } from '../../shared/posts';
import { deleteState, editState, kickoffLabel, rungState } from './slipActions';

// 1:00 PM CT on Sat Oct 24; kickoff 7:20 PM CT the same day
const now = new Date('2026-10-24T18:00:00Z');
const kickoff = '2026-10-25T00:20:00Z';
const minsAgo = (m: number) =>
  new Date(now.getTime() - m * 60_000).toISOString();

function slip(
  type: FeedPost['type'],
  {
    startsAt = kickoff,
    result = 'PENDING' as FeedPost['bets'][number]['result'],
    postedMinsAgo = 5,
    rungs = 1,
  } = {}
): FeedPost {
  const bet = {
    result,
    legs: [{ result, startsAt }],
  };
  return {
    type,
    createdAt: minsAgo(postedMinsAgo),
    group: null,
    bets: Array.from({ length: rungs }, () => bet),
  } as unknown as FeedPost;
}

describe('kickoffLabel', () => {
  it('drops the weekday for today', () => {
    expect(kickoffLabel(new Date(kickoff), now)).toBe('7:20 PM CT');
    expect(kickoffLabel(new Date('2026-10-25T17:00:00Z'), now)).toBe(
      'Sun 12:00 PM CT'
    );
  });
});

describe('editState', () => {
  it('says until when, then why it locked', () => {
    expect(editState(slip('STRAIGHT'), now, false)).toEqual({
      allowed: true,
      note: 'Until 7:20 PM CT',
    });
    expect(
      editState(slip('STRAIGHT', { startsAt: minsAgo(10) }), now, false)
    ).toEqual({ allowed: false, note: 'Locked at kickoff' });
    expect(editState(slip('PARLAY', { result: 'WON' }), now, false)).toEqual({
      allowed: false,
      note: 'Locked once graded',
    });
  });

  it('is open with no note for admins, and not offered on ladders', () => {
    expect(editState(slip('PARLAY', { result: 'WON' }), now, true)).toEqual({
      allowed: true,
      note: null,
    });
    expect(editState(slip('LADDER', { rungs: 2 }), now, false)).toBeNull();
  });
});

describe('rungState', () => {
  it('follows kickoff for the author and the cap for everyone', () => {
    expect(rungState(slip('LADDER', { rungs: 2 }), now, false)?.note).toBe(
      'Until 7:20 PM CT'
    );
    expect(
      rungState(slip('LADDER', { rungs: 2, startsAt: minsAgo(1) }), now, false)
    ).toEqual({ allowed: false, note: 'Locked at kickoff' });
    expect(rungState(slip('LADDER', { rungs: 10 }), now, true)).toEqual({
      allowed: false,
      note: 'Max 10 rungs',
    });
  });
});

describe('deleteState', () => {
  it('counts down the grace window, then locks open slips', () => {
    expect(deleteState(slip('STRAIGHT'), now, false).note).toBe('10 min left');
    expect(
      deleteState(slip('STRAIGHT', { postedMinsAgo: 20 }), now, false)
    ).toEqual({ allowed: false, note: 'Settle it first (15 min passed)' });
  });

  it('notes that settled slips still count', () => {
    expect(
      deleteState(
        slip('STRAIGHT', { result: 'LOST', postedMinsAgo: 600 }),
        now,
        false
      )
    ).toEqual({ allowed: true, note: 'Still counts in stats' });
  });

  it('lets admins delete past the window with no clock', () => {
    expect(
      deleteState(slip('STRAIGHT', { postedMinsAgo: 20 }), now, true)
    ).toEqual({ allowed: true, note: null });
  });
});
