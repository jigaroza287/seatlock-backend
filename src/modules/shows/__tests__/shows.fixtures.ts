import type { CreateShowInput, SeatMap, Show, ShowSeatView } from '../shows.type.js';

// Shared valid baseline for shows tests. Frozen so a test can't change it for the others.
// Keep case-specific changes inline in each test, e.g. { ...showInput, priceMinor: -1 }.

export const showInput: Readonly<CreateShowInput> = Object.freeze({
  eventId: '019a0000-0000-7000-8000-000000000101',
  screenId: '019a0000-0000-7000-8000-000000000201',
  startsAt: '2026-12-01T14:30:00.000Z',
  priceMinor: 50_000,
});

export const show: Readonly<Show> = Object.freeze({
  id: '019a0000-0000-7000-8000-000000000001',
  ...showInput,
  endsAt: '2026-12-01T17:00:00.000Z',
});

// Repository output for show: A1 free, A2 taken, B1 free. Sorted as the query returns them.
export const showSeatViews: readonly ShowSeatView[] = Object.freeze([
  {
    id: '019a0000-0000-7000-8000-000000000301',
    rowLabel: 'A',
    seatNumber: 1,
    category: 'standard',
    status: 'available',
  },
  {
    id: '019a0000-0000-7000-8000-000000000302',
    rowLabel: 'A',
    seatNumber: 2,
    category: 'standard',
    status: 'unavailable',
  },
  {
    id: '019a0000-0000-7000-8000-000000000303',
    rowLabel: 'B',
    seatNumber: 1,
    category: 'premium',
    status: 'available',
  },
]);

// showSeatViews grouped by toSeatMap.
export const seatMap: Readonly<SeatMap> = Object.freeze<SeatMap>({
  showId: show.id,
  available: 2,
  rows: [
    {
      row: 'A',
      seats: [
        {
          id: '019a0000-0000-7000-8000-000000000301',
          seatNumber: 1,
          category: 'standard',
          status: 'available',
        },
        {
          id: '019a0000-0000-7000-8000-000000000302',
          seatNumber: 2,
          category: 'standard',
          status: 'unavailable',
        },
      ],
    },
    {
      row: 'B',
      seats: [
        {
          id: '019a0000-0000-7000-8000-000000000303',
          seatNumber: 1,
          category: 'premium',
          status: 'available',
        },
      ],
    },
  ],
});
