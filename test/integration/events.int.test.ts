import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { eventInput } from '../../src/modules/events/__tests__/events.fixtures.js';
import type { CreateEventInput, Event } from '../../src/modules/events/events.type.js';
import type { Show } from '../../src/modules/shows/shows.type.js';

// Real app, real database. Covers what the mocked route tests can't: constraints, queries, persistence.

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const missingId = '019a0000-0000-7000-8000-000000000999';

async function createEvent(overrides: Partial<CreateEventInput> = {}): Promise<Event> {
  const res = await request(app)
    .post('/api/events')
    .send({ ...eventInput, ...overrides });
  expect(res.status).toBe(201);
  return (res.body as { data: Event }).data;
}

function titlesOf(body: unknown): string[] {
  return (body as { data: Event[] }).data.map((event) => event.title);
}

// Parent rows are setup, not under test, so they go straight through Prisma.
async function createScreenId(): Promise<string> {
  const venue = await prisma.venue.create({ data: { name: 'Main hall', city: 'Pune' } });
  const screen = await prisma.screen.create({ data: { name: 'Screen 1', venueId: venue.id } });
  // Show create needs at least one seat to copy into show_seats.
  await prisma.seat.create({
    data: { screenId: screen.id, rowLabel: 'A', seatNumber: 1, category: 'standard' },
  });
  return screen.id;
}

// Through the API, so the repository computes endsAt from the event's duration.
async function createShow(eventId: string, screenId: string, startsAt: string): Promise<Show> {
  const res = await request(app)
    .post('/api/shows')
    .send({ eventId, screenId, startsAt, priceMinor: 50_000 });
  expect(res.status).toBe(201);
  return (res.body as { data: Show }).data;
}

async function fetchShow(id: string): Promise<Show> {
  const res = await request(app).get(`/api/shows/${id}`);
  expect(res.status).toBe(200);
  return (res.body as { data: Show }).data;
}

describe('events integration', () => {
  describe('POST /api/events', () => {
    it('saves the event with a database-generated id, readable via Location', async () => {
      const res = await request(app).post('/api/events').send(eventInput);

      expect(res.status).toBe(201);
      const created = (res.body as { data: Event }).data;
      expect(created).toEqual({ id: expect.stringMatching(uuidV7) as string, ...eventInput });
      expect(res.headers['location']).toBe(`/api/events/${created.id}`);

      const fetched = await request(app).get(`/api/events/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual({ data: created });
    });

    it('returns 409 when the title differs only in case', async () => {
      await createEvent();

      const res = await request(app)
        .post('/api/events')
        .send({ ...eventInput, title: eventInput.title.toUpperCase() });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_CONFLICT' } });
    });
  });

  describe('GET /api/events', () => {
    beforeEach(async () => {
      await createEvent({ title: 'Stand-up night', category: 'comedy' });
      await createEvent({ title: 'Rock concert', category: 'concert' });
      await createEvent({ title: 'Late-night stand-up', category: 'comedy' });
    });

    it('returns all events ordered by title with the total', async () => {
      const res = await request(app).get('/api/events');

      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).toEqual(['Late-night stand-up', 'Rock concert', 'Stand-up night']);
      expect(res.body).toMatchObject({ pagination: { limit: 20, offset: 0, total: 3 } });
    });

    it('searches titles case-insensitively', async () => {
      const res = await request(app).get('/api/events?search=STAND-UP');

      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).toEqual(['Late-night stand-up', 'Stand-up night']);
      expect(res.body).toMatchObject({ pagination: { total: 2 } });
    });

    it('filters by category', async () => {
      const res = await request(app).get('/api/events?category=concert');

      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).toEqual(['Rock concert']);
      expect(res.body).toMatchObject({ pagination: { total: 1 } });
    });

    it('pages with limit and offset while total counts every match', async () => {
      const res = await request(app).get('/api/events?limit=1&offset=1');

      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).toEqual(['Rock concert']);
      expect(res.body).toMatchObject({ pagination: { limit: 1, offset: 1, total: 3 } });
    });
  });

  describe('PATCH /api/events/:id', () => {
    it('saves the change', async () => {
      const created = await createEvent();

      const res = await request(app).patch(`/api/events/${created.id}`).send({ durationMins: 120 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...created, durationMins: 120 } });

      const fetched = await request(app).get(`/api/events/${created.id}`);
      expect(fetched.body).toEqual({ data: { ...created, durationMins: 120 } });
    });

    it('returns 404 when the event does not exist', async () => {
      const res = await request(app).patch(`/api/events/${missingId}`).send({ durationMins: 120 });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_NOT_FOUND' } });
    });

    it('returns 409 when renaming onto an existing title in another case', async () => {
      await createEvent({ title: 'Rock concert' });
      const other = await createEvent({ title: 'Jazz evening' });

      const res = await request(app)
        .patch(`/api/events/${other.id}`)
        .send({ title: 'ROCK CONCERT' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_CONFLICT' } });
    });

    describe('with shows', () => {
      let event: Event;
      let screenId: string;

      // The fixture event runs 90 minutes, so a show at 14:30 ends at 16:00.
      beforeEach(async () => {
        event = await createEvent();
        screenId = await createScreenId();
      });

      it('moves endsAt of its shows when durationMins changes', async () => {
        const show = await createShow(event.id, screenId, '2026-12-01T14:30:00Z');

        const res = await request(app).patch(`/api/events/${event.id}`).send({ durationMins: 120 });

        expect(res.status).toBe(200);
        expect(await fetchShow(show.id)).toEqual({ ...show, endsAt: '2026-12-01T16:30:00.000Z' });
      });

      it('leaves its shows unchanged when durationMins is not sent', async () => {
        const show = await createShow(event.id, screenId, '2026-12-01T14:30:00Z');

        const res = await request(app)
          .patch(`/api/events/${event.id}`)
          .send({ title: 'Late-night stand-up' });

        expect(res.status).toBe(200);
        expect(await fetchShow(show.id)).toEqual(show);
      });

      // The UPDATE of shows fails on shows_no_overlap, so the event update rolls back too.
      it('returns 409 and changes nothing when a longer duration makes shows overlap', async () => {
        const show = await createShow(event.id, screenId, '2026-12-01T14:30:00Z');
        const otherEvent = await createEvent({ title: 'Rock concert' });
        const nextShow = await createShow(otherEvent.id, screenId, '2026-12-01T16:00:00Z');

        const res = await request(app).patch(`/api/events/${event.id}`).send({ durationMins: 120 });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({
          error: { code: 'EVENT_CONFLICT', message: 'Shows on this screen would overlap' },
        });

        const fetched = await request(app).get(`/api/events/${event.id}`);
        expect(fetched.body).toEqual({ data: event });
        expect(await fetchShow(show.id)).toEqual(show);
        expect(await fetchShow(nextShow.id)).toEqual(nextShow);
      });
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('removes the event so it can no longer be fetched', async () => {
      const created = await createEvent();

      const res = await request(app).delete(`/api/events/${created.id}`);
      expect(res.status).toBe(204);

      const fetched = await request(app).get(`/api/events/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 when the event does not exist', async () => {
      const res = await request(app).delete(`/api/events/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_NOT_FOUND' } });
    });

    // ON DELETE RESTRICT raises 23001, Prisma reports it as P2003, the repository maps it to 409.
    it('returns 409 and keeps the event when it has a show', async () => {
      const created = await createEvent();
      const venue = await prisma.venue.create({ data: { name: 'Main hall', city: 'Pune' } });
      const screen = await prisma.screen.create({ data: { name: 'Screen 1', venueId: venue.id } });
      const startsAt = new Date('2026-12-01T14:30:00Z');
      await prisma.show.create({
        data: {
          eventId: created.id,
          screenId: screen.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + created.durationMins * 60 * 1000),
          priceMinor: 50_000,
        },
      });

      const res = await request(app).delete(`/api/events/${created.id}`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'EVENT_CONFLICT', message: 'Event has scheduled shows' },
      });

      const fetched = await request(app).get(`/api/events/${created.id}`);
      expect(fetched.status).toBe(200);
    });
  });
});
