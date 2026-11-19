import { venue } from '../../venues/__tests__/venues.fixtures.js';
import type { CreateScreenInput, Screen } from '../screens.type.js';

// Shared valid baseline for screens tests. Frozen so a test can't change it for the others.
// Keep case-specific changes inline in each test, e.g. { ...screenInput, name: '   ' }.

export const screenInput: Readonly<CreateScreenInput> = Object.freeze({
  name: 'Screen 1',
});

export const screenInputWithDifferentCase: Readonly<CreateScreenInput> = Object.freeze({
  name: 'screen 1',
});

export const screen: Readonly<Screen> = Object.freeze({
  id: '019a0000-0000-7000-8000-000000000201',
  venueId: venue.id,
  name: 'Screen 1',
});
