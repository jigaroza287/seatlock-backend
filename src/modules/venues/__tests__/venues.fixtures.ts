import type { CreateVenueInput, Venue } from '../venues.type.js';

// Shared valid baseline for venues tests. Frozen so a test can't change it for the others.
// Keep case-specific changes inline in each test, e.g. { ...venueInput, name: '   ' }.

export const venueInput: Readonly<CreateVenueInput> = Object.freeze({
  name: 'Main hall',
  city: 'Pune',
  address: '12 Station Road',
});

export const venue: Readonly<Venue> = Object.freeze({
  id: '019a0000-0000-7000-8000-000000000101',
  name: 'Main hall',
  city: 'Pune',
  address: '12 Station Road',
});
