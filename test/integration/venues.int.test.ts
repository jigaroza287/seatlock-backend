import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { venueInput } from '../../src/modules/venues/__tests__/venues.fixtures.js';
import type { CreateVenueInput, Venue } from '../../src/modules/venues/venues.type.js';

// Real app, real database. Covers what the mocked route tests can't: constraints, queries, persistence.

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const missingId = '019a0000-0000-7000-8000-000000000999';

async function createVenue(overrides: Partial<CreateVenueInput> = {}): Promise<Venue> {
  const res = await request(app)
    .post('/api/venues')
    .send({ ...venueInput, ...overrides });
  expect(res.status).toBe(201);
  return (res.body as { data: Venue }).data;
}

function namesAndCitiesOf(body: unknown): string[] {
  return (body as { data: Venue[] }).data.map((venue) => `${venue.name}, ${venue.city}`);
}

describe('venues integration', () => {
  describe('POST /api/venues', () => {
    it('saves the venue with a database-generated id, readable via Location', async () => {
      const res = await request(app).post('/api/venues').send(venueInput);

      expect(res.status).toBe(201);
      const created = (res.body as { data: Venue }).data;
      expect(created).toEqual({ id: expect.stringMatching(uuidV7) as string, ...venueInput });
      expect(res.headers['location']).toBe(`/api/venues/${created.id}`);

      const fetched = await request(app).get(`/api/venues/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual({ data: created });
    });

    it('stores a null address when the address is omitted', async () => {
      const { name, city } = venueInput;

      const res = await request(app).post('/api/venues').send({ name, city });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ data: { name, city, address: null } });
    });

    it('returns 409 when the name already exists in the same city', async () => {
      await createVenue();

      const res = await request(app).post('/api/venues').send(venueInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: {
          code: 'VENUE_CONFLICT',
          message: 'A venue with this name already exists in this city',
        },
      });
    });

    it('allows the same name in another city', async () => {
      await createVenue();

      const res = await request(app)
        .post('/api/venues')
        .send({ ...venueInput, city: 'Mumbai' });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/venues', () => {
    beforeEach(async () => {
      await createVenue({ name: 'Main hall', city: 'Pune' });
      await createVenue({ name: 'City arena', city: 'Mumbai' });
      await createVenue({ name: 'Main hall', city: 'Mumbai' });
    });

    it('returns all venues ordered by name, then city, with the total', async () => {
      const res = await request(app).get('/api/venues');

      expect(res.status).toBe(200);
      expect(namesAndCitiesOf(res.body)).toEqual([
        'City arena, Mumbai',
        'Main hall, Mumbai',
        'Main hall, Pune',
      ]);
      expect(res.body).toMatchObject({ pagination: { limit: 20, offset: 0, total: 3 } });
    });

    it('searches names case-insensitively', async () => {
      const res = await request(app).get('/api/venues?search=HALL');

      expect(res.status).toBe(200);
      expect(namesAndCitiesOf(res.body)).toEqual(['Main hall, Mumbai', 'Main hall, Pune']);
      expect(res.body).toMatchObject({ pagination: { total: 2 } });
    });

    it('filters by city with a case-insensitive exact match', async () => {
      const exact = await request(app).get('/api/venues?city=mumbai');
      expect(namesAndCitiesOf(exact.body)).toEqual(['City arena, Mumbai', 'Main hall, Mumbai']);

      const partial = await request(app).get('/api/venues?city=Mum');
      expect(namesAndCitiesOf(partial.body)).toEqual([]);
      expect(partial.body).toMatchObject({ pagination: { total: 0 } });
    });

    it('pages with limit and offset while total counts every match', async () => {
      const res = await request(app).get('/api/venues?limit=1&offset=1');

      expect(res.status).toBe(200);
      expect(namesAndCitiesOf(res.body)).toEqual(['Main hall, Mumbai']);
      expect(res.body).toMatchObject({ pagination: { limit: 1, offset: 1, total: 3 } });
    });
  });

  describe('PATCH /api/venues/:id', () => {
    it('saves the change', async () => {
      const created = await createVenue();

      const res = await request(app).patch(`/api/venues/${created.id}`).send({ city: 'Nashik' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...created, city: 'Nashik' } });

      const fetched = await request(app).get(`/api/venues/${created.id}`);
      expect(fetched.body).toEqual({ data: { ...created, city: 'Nashik' } });
    });

    it('clears the address with null', async () => {
      const created = await createVenue();

      const res = await request(app).patch(`/api/venues/${created.id}`).send({ address: null });

      expect(res.status).toBe(200);

      const fetched = await request(app).get(`/api/venues/${created.id}`);
      expect(fetched.body).toEqual({ data: { ...created, address: null } });
    });

    it('returns 404 when the venue does not exist', async () => {
      const res = await request(app).patch(`/api/venues/${missingId}`).send({ city: 'Nashik' });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });

    it('returns 409 when renaming onto an existing name in the same city', async () => {
      await createVenue({ name: 'Main hall' });
      const other = await createVenue({ name: 'Side hall' });

      const res = await request(app).patch(`/api/venues/${other.id}`).send({ name: 'Main hall' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_CONFLICT' } });
    });
  });

  describe('DELETE /api/venues/:id', () => {
    it('removes the venue so it can no longer be fetched', async () => {
      const created = await createVenue();

      const res = await request(app).delete(`/api/venues/${created.id}`);
      expect(res.status).toBe(204);

      const fetched = await request(app).get(`/api/venues/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 when the venue does not exist', async () => {
      const res = await request(app).delete(`/api/venues/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });

    // ON DELETE RESTRICT raises 23001, Prisma reports it as P2003, the repository maps it to 409.
    it('returns 409 and keeps the venue when it has a screen', async () => {
      const created = await createVenue();
      await prisma.screen.create({ data: { name: 'Screen 1', venueId: created.id } });

      const res = await request(app).delete(`/api/venues/${created.id}`);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'VENUE_CONFLICT', message: 'Venue still has screens' },
      });

      const fetched = await request(app).get(`/api/venues/${created.id}`);
      expect(fetched.status).toBe(200);
    });
  });
});
