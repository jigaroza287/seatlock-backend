import { screen } from '../../screens/__tests__/screens.fixtures.js';
import type { CreateSeatInput, CreateSeatLayoutInput, Seat } from '../seats.type.js';

// Shared valid baseline for seats tests. Frozen so a test can't change it for the others.
// Keep case-specific changes inline in each test, e.g. { ...seatInput, rowLabel: '   ' }.

export const seatInput: Readonly<CreateSeatInput> = Object.freeze({
  rowLabel: 'A',
  seatNumber: 1,
  category: 'standard',
});

export const seat: Readonly<Seat> = Object.freeze({
  id: '019a0000-0000-7000-8000-000000000301',
  screenId: screen.id,
  rowLabel: 'A',
  seatNumber: 1,
  category: 'standard',
});

// Two rows, five seats: A1-A2 standard, B1-B3 premium.
export const seatLayoutInput: Readonly<CreateSeatLayoutInput> = Object.freeze({
  rows: [
    { rowLabel: 'A', seatCount: 2, category: 'standard' },
    { rowLabel: 'B', seatCount: 3, category: 'premium' },
  ],
});
