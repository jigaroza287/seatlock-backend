import { describe, expect, it } from 'vitest';
import { toSeatMap } from '../shows.mapper.js';
import { seatMap, show, showSeatViews } from './shows.fixtures.js';

describe('toSeatMap', () => {
  it('groups seats into rows, drops rowLabel from each seat and counts available seats', () => {
    expect(toSeatMap(show.id, showSeatViews)).toEqual(seatMap);
  });

  it('keeps the input order of rows and seats', () => {
    const [a1, a2, b1] = showSeatViews;
    if (a1 === undefined || a2 === undefined || b1 === undefined) {
      throw new Error('fixture needs three seats');
    }

    const result = toSeatMap(show.id, [b1, a2, a1]);

    expect(result.rows.map((row) => row.row)).toEqual(['B', 'A']);
    expect(result.rows[1]?.seats.map((seat) => seat.seatNumber)).toEqual([2, 1]);
  });

  it('returns 0 available when every seat is unavailable', () => {
    const taken = showSeatViews.map((seat) => ({ ...seat, status: 'unavailable' as const }));

    expect(toSeatMap(show.id, taken).available).toBe(0);
  });

  it('returns no rows for no seats', () => {
    expect(toSeatMap(show.id, [])).toEqual({ showId: show.id, available: 0, rows: [] });
  });
});
