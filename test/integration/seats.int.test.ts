import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { seatInput } from '../../src/modules/seats/__tests__/seats.fixtures.js';
import type { CreateSeatInput, Seat } from '../../src/modules/seats/seats.type.js';
import { venueInput } from '../../src/modules/venues/__tests__/venues.fixtures.js';

// Real app, real database. Covers what the mocked route tests can't: constraints, queries, persistence.

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const missingId = '019a0000-0000-7000-8000-000000000999';

// Parent rows are setup, not under test, so they go straight through Prisma.
async function createScreenId(name = 'Screen 1'): Promise<string> {
  const venue = await prisma.venue.create({
    data: { name: `${venueInput.name} ${name}`, city: venueInput.city },
  });
  const screen = await prisma.screen.create({ data: { venueId: venue.id, name } });
  return screen.id;
}

async function createSeat(
  screenId: string,
  overrides: Partial<CreateSeatInput> = {}
): Promise<Seat> {
  const res = await request(app)
    .post(`/api/screens/${screenId}/seats`)
    .send({ ...seatInput, ...overrides });
  expect(res.status).toBe(201);
  return (res.body as { data: Seat }).data;
}

function labelsOf(body: unknown): string[] {
  return (body as { data: Seat[] }).data.map((seat) => `${seat.rowLabel}${seat.seatNumber}`);
}

describe('seats integration', () => {
  let screenId: string;

  beforeEach(async () => {
    screenId = await createScreenId();
  });

  describe('POST /api/screens/:screenId/seats', () => {
    it('saves the seat under the screen, readable via Location', async () => {
      const res = await request(app).post(`/api/screens/${screenId}/seats`).send(seatInput);

      expect(res.status).toBe(201);
      const created = (res.body as { data: Seat }).data;
      expect(created).toEqual({
        id: expect.stringMatching(uuidV7) as string,
        screenId,
        ...seatInput,
      });
      expect(res.headers['location']).toBe(`/api/seats/${created.id}`);

      const fetched = await request(app).get(`/api/seats/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual({ data: created });
    });

    it('stores the row label in uppercase', async () => {
      const created = await createSeat(screenId, { rowLabel: 'b' });

      expect(created.rowLabel).toBe('B');
      const row = await prisma.seat.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.rowLabel).toBe('B');
    });

    // seats_screen_id_fkey raises 23503, which maps to 404 because the screen id is in the path.
    it('returns 404 when the screen does not exist', async () => {
      const res = await request(app).post(`/api/screens/${missingId}/seats`).send(seatInput);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        error: { code: 'SCREEN_NOT_FOUND', message: 'Screen does not exist' },
      });
    });

    it('returns 409 when the seat already exists on this screen', async () => {
      await createSeat(screenId);

      const res = await request(app).post(`/api/screens/${screenId}/seats`).send(seatInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SEAT_CONFLICT', message: 'This seat already exists on this screen' },
      });
    });

    it('returns 409 when the same seat is sent with a lowercase row label', async () => {
      await createSeat(screenId);

      const res = await request(app)
        .post(`/api/screens/${screenId}/seats`)
        .send({ ...seatInput, rowLabel: seatInput.rowLabel.toLowerCase() });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_CONFLICT' } });
    });

    // seats_row_label_uppercase_check rejects lower row label written straight to the database.
    it('rejects a lowercase row label written straight to the database', async () => {
      await expect(
        prisma.seat.create({
          data: { screenId, rowLabel: 'a', seatNumber: seatInput.seatNumber, category: 'standard' },
        })
      ).rejects.toMatchObject({ code: 'P2039' });
    });

    it('allows the same row and number on another screen', async () => {
      await createSeat(screenId);
      const otherScreenId = await createScreenId('Screen 2');

      const res = await request(app).post(`/api/screens/${otherScreenId}/seats`).send(seatInput);

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/screens/:screenId/seats', () => {
    beforeEach(async () => {
      await createSeat(screenId, { rowLabel: 'B', seatNumber: 2, category: 'premium' });
      await createSeat(screenId, { rowLabel: 'A', seatNumber: 2 });
      await createSeat(screenId, { rowLabel: 'B', seatNumber: 1, category: 'premium' });
      await createSeat(screenId, { rowLabel: 'A', seatNumber: 1 });
      const otherScreenId = await createScreenId('Screen 2');
      await createSeat(otherScreenId, { rowLabel: 'Z', seatNumber: 1 });
    });

    it("returns only this screen's seats ordered by row then number, with the total", async () => {
      const res = await request(app).get(`/api/screens/${screenId}/seats`);

      expect(res.status).toBe(200);
      expect(labelsOf(res.body)).toEqual(['A1', 'A2', 'B1', 'B2']);
      expect(res.body).toMatchObject({ pagination: { limit: 20, offset: 0, total: 4 } });
    });

    it('filters by category', async () => {
      const res = await request(app).get(`/api/screens/${screenId}/seats?category=premium`);

      expect(res.status).toBe(200);
      expect(labelsOf(res.body)).toEqual(['B1', 'B2']);
      expect(res.body).toMatchObject({ pagination: { total: 2 } });
    });

    it('pages with limit and offset while total counts every match', async () => {
      const res = await request(app).get(`/api/screens/${screenId}/seats?limit=2&offset=1`);

      expect(res.status).toBe(200);
      expect(labelsOf(res.body)).toEqual(['A2', 'B1']);
      expect(res.body).toMatchObject({ pagination: { limit: 2, offset: 1, total: 4 } });
    });

    it('returns 404 when the screen does not exist', async () => {
      const res = await request(app).get(`/api/screens/${missingId}/seats`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });
  });

  describe('PATCH /api/seats/:id', () => {
    it('saves the change', async () => {
      const created = await createSeat(screenId);
      const changes = { rowLabel: 'c', category: 'recliner' };

      const res = await request(app).patch(`/api/seats/${created.id}`).send(changes);

      expect(res.status).toBe(200);
      const expected = { ...created, rowLabel: 'C', category: 'recliner' };
      expect(res.body).toEqual({ data: expected });

      const fetched = await request(app).get(`/api/seats/${created.id}`);
      expect(fetched.body).toEqual({ data: expected });
    });

    it('returns 404 when the seat does not exist', async () => {
      const res = await request(app).patch(`/api/seats/${missingId}`).send({ seatNumber: 2 });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_NOT_FOUND' } });
    });

    it('returns 409 when moving onto an existing seat on the same screen', async () => {
      await createSeat(screenId, { seatNumber: 1 });
      const other = await createSeat(screenId, { seatNumber: 2 });

      const res = await request(app).patch(`/api/seats/${other.id}`).send({ seatNumber: 1 });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_CONFLICT' } });
    });
  });

  describe('DELETE /api/seats/:id', () => {
    it('removes the seat so it can no longer be fetched', async () => {
      const created = await createSeat(screenId);

      const res = await request(app).delete(`/api/seats/${created.id}`);
      expect(res.status).toBe(204);

      const fetched = await request(app).get(`/api/seats/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 when the seat does not exist', async () => {
      const res = await request(app).delete(`/api/seats/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_NOT_FOUND' } });
    });
  });
});
