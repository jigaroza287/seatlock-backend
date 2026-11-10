import type { CreateEventInput, Event } from '../events.type.js';

// Shared valid baseline for events tests. Frozen so a test can't change it for the others.
// Keep case-specific changes inline in each test, e.g. { ...eventInput, title: '   ' }.

export const eventInput: Readonly<CreateEventInput> = Object.freeze({
  title: 'Stand-up night',
  description: 'A live evening of stand-up comedy.',
  category: 'comedy',
  durationMins: 90,
  language: 'en',
});

export const event: Readonly<Event> = Object.freeze({
  id: '019a0000-0000-7000-8000-000000000001',
  ...eventInput,
});
