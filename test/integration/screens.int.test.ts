import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import {
  screenInput,
  screenInputWithDifferentCase,
} from '../../src/modules/screens/__tests__/screens.fixtures.js';
import type { CreateScreenInput, Screen } from '../../src/modules/screens/screens.type.js';
import { venueInput } from '../../src/modules/venues/__tests__/venues.fixtures.js';

// Real app, real database. Covers what the mocked route tests can't: constraints, queries, persistence.

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const missingId = '019a0000-0000-7000-8000-000000000999';

// Parent rows are setup, not under test, so they go straight through Prisma.
async function createVenueId(city = venueInput.city): Promise<string> {
  const row = await prisma.venue.create({ data: { name: venueInput.name, city } });
  return row.id;
}

async function createScreen(
  venueId: string,
  overrides: Partial<CreateScreenInput> = {}
): Promise<Screen> {
  const res = await request(app)
    .post(`/api/venues/${venueId}/screens`)
    .send({ ...screenInput, ...overrides });
  expect(res.status).toBe(201);
  return (res.body as { data: Screen }).data;
}

function namesOf(body: unknown): string[] {
  return (body as { data: Screen[] }).data.map((screen) => screen.name);
}

describe('screens integration', () => {
  let venueId: string;

  beforeEach(async () => {
    venueId = await createVenueId();
  });

  describe('POST /api/venues/:venueId/screens', () => {
    it('saves the screen under the venue, readable via Location', async () => {
      const res = await request(app).post(`/api/venues/${venueId}/screens`).send(screenInput);

      expect(res.status).toBe(201);
      const created = (res.body as { data: Screen }).data;
      expect(created).toEqual({
        id: expect.stringMatching(uuidV7) as string,
        venueId,
        ...screenInput,
      });
      expect(res.headers['location']).toBe(`/api/screens/${created.id}`);

      const fetched = await request(app).get(`/api/screens/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual({ data: created });
    });

    // screens_venue_id_fkey raises 23503, which maps to 404 because the venue id is in the path.
    it('returns 404 when the venue does not exist', async () => {
      const res = await request(app).post(`/api/venues/${missingId}/screens`).send(screenInput);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: { code: 'VENUE_NOT_FOUND', message: 'Venue does not exist' },
      });
    });

    it('returns 409 when the name already exists at this venue', async () => {
      await createScreen(venueId);

      const res = await request(app).post(`/api/venues/${venueId}/screens`).send(screenInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: {
          code: 'SCREEN_CONFLICT',
          message: 'A screen with this name already exists at this venue',
        },
      });
    });

    it('returns 409 when the same name with different case already exists at this venue', async () => {
      await createScreen(venueId);

      const res = await request(app)
        .post(`/api/venues/${venueId}/screens`)
        .send(screenInputWithDifferentCase);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: {
          code: 'SCREEN_CONFLICT',
          message: 'A screen with this name already exists at this venue',
        },
      });
    });

    it('allows the same name at another venue', async () => {
      await createScreen(venueId);
      const otherVenueId = await createVenueId('Mumbai');

      const res = await request(app).post(`/api/venues/${otherVenueId}/screens`).send(screenInput);

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/venues/:venueId/screens', () => {
    beforeEach(async () => {
      await createScreen(venueId, { name: 'Screen B' });
      await createScreen(venueId, { name: 'Screen A' });
      await createScreen(venueId, { name: 'Screen C' });
      const otherVenueId = await createVenueId('Mumbai');
      await createScreen(otherVenueId, { name: 'Other venue screen' });
    });

    it("returns only this venue's screens ordered by name, with the total", async () => {
      const res = await request(app).get(`/api/venues/${venueId}/screens`);

      expect(res.status).toBe(200);
      expect(namesOf(res.body)).toEqual(['Screen A', 'Screen B', 'Screen C']);
      expect(res.body).toMatchObject({ pagination: { limit: 20, offset: 0, total: 3 } });
    });

    it('pages with limit and offset while total counts every match', async () => {
      const res = await request(app).get(`/api/venues/${venueId}/screens?limit=1&offset=1`);

      expect(res.status).toBe(200);
      expect(namesOf(res.body)).toEqual(['Screen B']);
      expect(res.body).toMatchObject({ pagination: { limit: 1, offset: 1, total: 3 } });
    });

    it('returns 404 when the venue does not exist', async () => {
      const res = await request(app).get(`/api/venues/${missingId}/screens`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });
  });

  describe('PATCH /api/screens/:id', () => {
    it('saves the change', async () => {
      const created = await createScreen(venueId);

      const res = await request(app).patch(`/api/screens/${created.id}`).send({ name: 'Screen 2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...created, name: 'Screen 2' } });

      const fetched = await request(app).get(`/api/screens/${created.id}`);
      expect(fetched.body).toEqual({ data: { ...created, name: 'Screen 2' } });
    });

    it('returns 404 when the screen does not exist', async () => {
      const res = await request(app).patch(`/api/screens/${missingId}`).send({ name: 'Screen 2' });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    it('returns 409 when renaming onto an existing name at the same venue', async () => {
      await createScreen(venueId, { name: 'Screen 1' });
      const other = await createScreen(venueId, { name: 'Screen 2' });

      const res = await request(app).patch(`/api/screens/${other.id}`).send({ name: 'Screen 1' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_CONFLICT' } });
    });
  });

  describe('DELETE /api/screens/:id', () => {
    it('removes the screen so it can no longer be fetched', async () => {
      const created = await createScreen(venueId);

      const res = await request(app).delete(`/api/screens/${created.id}`);
      expect(res.status).toBe(204);

      const fetched = await request(app).get(`/api/screens/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    // seats_screen_id_fkey is ON DELETE CASCADE.
    it('deletes the screen seats with it', async () => {
      const created = await createScreen(venueId);
      await prisma.seat.create({
        data: { screenId: created.id, rowLabel: 'A', seatNumber: 1, category: 'standard' },
      });

      const res = await request(app).delete(`/api/screens/${created.id}`);

      expect(res.status).toBe(204);
      await expect(prisma.seat.count({ where: { screenId: created.id } })).resolves.toBe(0);
    });

    it('returns 404 when the screen does not exist', async () => {
      const res = await request(app).delete(`/api/screens/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    // ON DELETE RESTRICT raises 23001, Prisma reports it as P2003, the repository maps it to 409.
    it('returns 409 and keeps the screen and its seats when it has a show', async () => {
      const created = await createScreen(venueId);
      await prisma.seat.create({
        data: { screenId: created.id, rowLabel: 'A', seatNumber: 1, category: 'standard' },
      });
      const event = await prisma.event.create({
        data: {
          title: 'Stand-up night',
          description: 'A live evening of stand-up comedy.',
          category: 'comedy',
          durationMins: 90,
          language: 'en',
        },
      });
      await prisma.show.create({
        data: {
          eventId: event.id,
          screenId: created.id,
          startsAt: new Date('2026-12-01T14:30:00.000Z'),
          // startsAt + the event's 90 minutes.
          endsAt: new Date('2026-12-01T16:00:00.000Z'),
          priceMinor: 50000,
        },
      });

      const res = await request(app).delete(`/api/screens/${created.id}`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SCREEN_CONFLICT', message: 'Screen has scheduled shows' },
      });

      const fetched = await request(app).get(`/api/screens/${created.id}`);
      expect(fetched.status).toBe(200);
      await expect(prisma.seat.count({ where: { screenId: created.id } })).resolves.toBe(1);
    });
  });
});
