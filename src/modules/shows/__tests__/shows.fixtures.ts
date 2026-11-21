import type { CreateShowInput, Show } from '../shows.type.js';

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
