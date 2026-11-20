import { describe, expect, it } from 'vitest';
import { screen } from '../../screens/__tests__/screens.fixtures.js';
import { expandLayout } from '../seats.layout.js';
import { seatLayoutInput } from './seats.fixtures.js';

describe('expandLayout', () => {
  it('creates one seat per number, numbered from 1 in each row, with the row category', () => {
    expect(expandLayout(screen.id, seatLayoutInput.rows)).toEqual([
      { screenId: screen.id, rowLabel: 'A', seatNumber: 1, category: 'standard' },
      { screenId: screen.id, rowLabel: 'A', seatNumber: 2, category: 'standard' },
      { screenId: screen.id, rowLabel: 'B', seatNumber: 1, category: 'premium' },
      { screenId: screen.id, rowLabel: 'B', seatNumber: 2, category: 'premium' },
      { screenId: screen.id, rowLabel: 'B', seatNumber: 3, category: 'premium' },
    ]);
  });

  it('keeps the row order from the input', () => {
    const seats = expandLayout(screen.id, [
      { rowLabel: 'C', seatCount: 1, category: 'recliner' },
      { rowLabel: 'A', seatCount: 1, category: 'standard' },
    ]);

    expect(seats.map((seat) => seat.rowLabel)).toEqual(['C', 'A']);
  });

  it('creates 100 seats for a row at the maximum count', () => {
    const seats = expandLayout(screen.id, [
      { rowLabel: 'A', seatCount: 100, category: 'standard' },
    ]);

    expect(seats).toHaveLength(100);
    expect(seats.at(-1)?.seatNumber).toBe(100);
  });

  it('returns no seats for no rows', () => {
    expect(expandLayout(screen.id, [])).toEqual([]);
  });
});
