import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app.js';
import { AppError } from '../../../shared/app-error.js';
import { screen } from '../../screens/__tests__/screens.fixtures.js';
import type { IScreenRepository } from '../../screens/screens.type.js';
import type { ISeatRepository } from '../seats.type.js';
import { seat, seatInput, seatLayoutInput } from './seats.fixtures.js';

// Replace the Prisma repositories so routes, controller, service and middleware run without a database.
// vi.hoisted lets the vi.mock factories, which run before imports, use these mocks.
const { repository, screenRepository } = vi.hoisted(() => ({
  repository: {
    findMany: vi.fn<ISeatRepository['findMany']>(),
    findById: vi.fn<ISeatRepository['findById']>(),
    create: vi.fn<ISeatRepository['create']>(),
    createMany: vi.fn<ISeatRepository['createMany']>(),
    update: vi.fn<ISeatRepository['update']>(),
    delete: vi.fn<ISeatRepository['delete']>(),
  },
  screenRepository: {
    findMany: vi.fn<IScreenRepository['findMany']>(),
    findById: vi.fn<IScreenRepository['findById']>(),
    create: vi.fn<IScreenRepository['create']>(),
    update: vi.fn<IScreenRepository['update']>(),
    delete: vi.fn<IScreenRepository['delete']>(),
  },
}));
vi.mock('../seats.repository.js', () => ({ seatRepository: repository }));
// The seat service looks up the screen before listing.
vi.mock('../../screens/screens.repository.js', () => ({ screenRepository }));
// app.ts also loads the other modules' repositories; stop them creating a real Prisma client.
vi.mock('../../../db/prisma.js', () => ({ prisma: {} }));

const screenSeatsUrl = `/api/screens/${screen.id}/seats`;
const seatUrl = `/api/seats/${seat.id}`;
const layoutUrl = `/api/screens/${screen.id}/seats/layout`;

const conflict = AppError.conflict('Seat', 'This seat already exists on this screen');

describe('seats routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/screens/:screenId/seats', () => {
    it('returns 200 with data and default pagination', async () => {
      screenRepository.findById.mockResolvedValue(screen);
      repository.findMany.mockResolvedValue({ items: [seat], total: 1 });

      const res = await request(app).get(screenSeatsUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [seat], pagination: { limit: 20, offset: 0, total: 1 } });
      expect(repository.findMany).toHaveBeenCalledWith(screen.id, { limit: 20, offset: 0 });
    });

    it('passes limit, offset and category from the query string', async () => {
      screenRepository.findById.mockResolvedValue(screen);
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app).get(`${screenSeatsUrl}?limit=5&offset=10&category=premium`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], pagination: { limit: 5, offset: 10, total: 0 } });
      expect(repository.findMany).toHaveBeenCalledWith(screen.id, {
        limit: 5,
        offset: 10,
        category: 'premium',
      });
    });

    it.each([
      { reason: 'limit is 0', query: 'limit=0' },
      { reason: 'limit is above 100', query: 'limit=101' },
      { reason: 'offset is negative', query: 'offset=-1' },
      { reason: 'limit is not a number', query: 'limit=abc' },
      { reason: 'category is unknown', query: 'category=vip' },
    ])('returns 400 when $reason', async ({ query }) => {
      const res = await request(app).get(`${screenSeatsUrl}?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the screen does not exist', async () => {
      screenRepository.findById.mockResolvedValue(null);

      const res = await request(app).get(screenSeatsUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/screens/:screenId/seats', () => {
    it('returns 201 with the seat and a Location header to the flat route', async () => {
      repository.create.mockResolvedValue(seat);

      const res = await request(app).post(screenSeatsUrl).send(seatInput);

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(seatUrl);
      expect(res.body).toEqual({ data: seat });
      expect(repository.create).toHaveBeenCalledWith(screen.id, seatInput);
    });

    it('passes an uppercased row label to the repository', async () => {
      repository.create.mockResolvedValue(seat);

      await request(app)
        .post(screenSeatsUrl)
        .send({ ...seatInput, rowLabel: ' a ' });

      expect(repository.create).toHaveBeenCalledWith(screen.id, { ...seatInput, rowLabel: 'A' });
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the row label is blank', body: { ...seatInput, rowLabel: '   ' } },
      { reason: 'the row label has two letters', body: { ...seatInput, rowLabel: 'AA' } },
      { reason: 'the seat number is 0', body: { ...seatInput, seatNumber: 0 } },
      { reason: 'the seat number is above 100', body: { ...seatInput, seatNumber: 101 } },
      { reason: 'the category is unknown', body: { ...seatInput, category: 'vip' } },
      { reason: 'the body has screenId', body: { ...seatInput, screenId: screen.id } },
      { reason: 'the body has id', body: { ...seatInput, id: seat.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post(screenSeatsUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the screen does not exist', async () => {
      repository.create.mockRejectedValue(AppError.notFound('Screen', 'Screen does not exist'));

      const res = await request(app).post(screenSeatsUrl).send(seatInput);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    it('returns 409 when the seat already exists on this screen', async () => {
      repository.create.mockRejectedValue(conflict);

      const res = await request(app).post(screenSeatsUrl).send(seatInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_CONFLICT' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'post', body: seatInput },
  ] as const)(
    '$method on the nested route returns 400 when the screen id is not a UUID',
    async ({ method, body }) => {
      const res = await request(app)[method]('/api/screens/not-a-uuid/seats').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(screenRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    }
  );

  describe('POST /api/screens/:screenId/seats/layout', () => {
    const row = { rowLabel: 'A', seatCount: 10, category: 'standard' };

    it('returns 201 with the screen id and created count, and no Location header', async () => {
      repository.createMany.mockResolvedValue(5);

      const res = await request(app).post(layoutUrl).send(seatLayoutInput);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ data: { screenId: screen.id, createdCount: 5 } });
      expect(res.headers['location']).toBeUndefined();
      expect(repository.createMany).toHaveBeenCalledTimes(1);
    });

    it('passes uppercased row labels to the repository', async () => {
      repository.createMany.mockResolvedValue(1);

      await request(app)
        .post(layoutUrl)
        .send({ rows: [{ ...row, rowLabel: ' b ', seatCount: 1 }] });

      expect(repository.createMany).toHaveBeenCalledWith([
        { screenId: screen.id, rowLabel: 'B', seatNumber: 1, category: 'standard' },
      ]);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'rows is empty', body: { rows: [] } },
      { reason: 'the row label has two letters', body: { rows: [{ ...row, rowLabel: 'AA' }] } },
      { reason: 'the seat count is not an integer', body: { rows: [{ ...row, seatCount: 2.5 }] } },
      { reason: 'the seat count is above 100', body: { rows: [{ ...row, seatCount: 101 }] } },
      { reason: 'the category is unknown', body: { rows: [{ ...row, category: 'vip' }] } },
      { reason: 'a row label repeats', body: { rows: [row, { ...row, rowLabel: 'a' }] } },
      { reason: 'the body has screenId', body: { ...seatLayoutInput, screenId: screen.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post(layoutUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.createMany).not.toHaveBeenCalled();
    });

    it('returns 400 when the screen id is not a UUID', async () => {
      const res = await request(app)
        .post('/api/screens/not-a-uuid/seats/layout')
        .send(seatLayoutInput);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.createMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the screen does not exist', async () => {
      repository.createMany.mockRejectedValue(AppError.notFound('Screen', 'Screen does not exist'));

      const res = await request(app).post(layoutUrl).send(seatLayoutInput);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    it('returns 409 when a seat in the layout already exists', async () => {
      repository.createMany.mockRejectedValue(
        AppError.conflict('Seat', 'Some seats in this layout already exist on this screen')
      );

      const res = await request(app).post(layoutUrl).send(seatLayoutInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_CONFLICT' } });
    });
  });

  describe('GET /api/seats/:id', () => {
    it('returns 200 with the seat', async () => {
      repository.findById.mockResolvedValue(seat);

      const res = await request(app).get(seatUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: seat });
    });

    it('returns 404 when the seat does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const res = await request(app).get(seatUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_NOT_FOUND' } });
    });
  });

  describe('PATCH /api/seats/:id', () => {
    const changes = { seatNumber: 2 };

    it('returns 200 with the updated seat', async () => {
      repository.update.mockResolvedValue({ ...seat, ...changes });

      const res = await request(app).patch(seatUrl).send(changes);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...seat, ...changes } });
      expect(repository.update).toHaveBeenCalledWith(seat.id, changes);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the body has an unknown field', body: { price: 100 } },
      { reason: 'the body has screenId', body: { screenId: screen.id } },
      { reason: 'the body has id', body: { id: seat.id } },
      { reason: 'the category is unknown', body: { category: 'vip' } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).patch(seatUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the seat does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const res = await request(app).patch(seatUrl).send(changes);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_NOT_FOUND' } });
    });

    it('returns 409 when the new row and number already exist on this screen', async () => {
      repository.update.mockRejectedValue(conflict);

      const res = await request(app).patch(seatUrl).send(changes);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_CONFLICT' } });
    });
  });

  describe('DELETE /api/seats/:id', () => {
    it('returns 204 with no body', async () => {
      repository.delete.mockResolvedValue(true);

      const res = await request(app).delete(seatUrl);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith(seat.id);
    });

    it('returns 404 when the seat does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      const res = await request(app).delete(seatUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SEAT_NOT_FOUND' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'patch', body: { seatNumber: 2 } },
    { method: 'delete', body: undefined },
  ] as const)('$method returns 400 when the seat id is not a UUID', async ({ method, body }) => {
    const res = await request(app)[method]('/api/seats/not-a-uuid').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
