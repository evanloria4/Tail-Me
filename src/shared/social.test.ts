import { describe, expect, it } from 'vitest';
import { orderReactions, reactionLabel } from './social';

describe('orderReactions', () => {
  it('lists quick reactions in their order, then the rest by count', () => {
    const order = orderReactions([
      { emoji: '🫠', count: 1 },
      { emoji: '🤡', count: 1 },
      { emoji: '🍕', count: 4 },
      { emoji: '🔥', count: 2 },
      { emoji: '🦄', count: 1 },
    ]).map((r) => r.emoji);
    expect(order).toEqual(['🔥', '🤡', '🍕', '🦄', '🫠']);
  });
});

describe('reactionLabel', () => {
  it('names quick reactions and falls back to the emoji', () => {
    expect(reactionLabel('🐐')).toBe('GOAT');
    expect(reactionLabel('🍕')).toBe('🍕');
  });
});
