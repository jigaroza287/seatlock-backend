import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app.js';
import { AppError } from '../../../shared/app-error.js';
import type { IShowRepository } from '../shows.type.js';
import { show, showInput } from './shows.fixtures.js';

// Replace the Prisma repository so routes, controller, service and middleware run without a database.
// vi.hoisted lets the vi.mock factory, which runs before imports, use these mocks.
const repository = vi.hoisted(() => ({
  findMany: vi.fn<IShowRepository['findMany']>(),
  findById: vi.fn<IShowRepository['findById']>(),
  create: vi.fn<IShowRepository['create']>(),
  update: vi.fn<IShowRepository['update']>(),
  delete: vi.fn<IShowRepository['delete']>(),
}));
vi.mock('../shows.repository.js', () => ({ showRepository: repository }));
// app.ts also loads the other modules' repositories; stop them creating a real Prisma client.
vi.mock('../../../db/prisma.js', () => ({ prisma: {} }));

const showUrl = `/api/shows/${show.id}`;

// What toAppError returns for shows_no_overlap.
const overlap = AppError.conflict('Show', 'Shows on this screen would overlap');
// What toAppError returns for shows_event_id_fkey on create or update.
const unknownEvent = new AppError(400, 'VALIDATION_ERROR', 'Invalid request', [
  { field: 'eventId', message: 'Event does not exist' },
]);

describe('shows routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/shows', () => {
    it('returns 200 with data and default pagination', async () => {
      repository.findMany.mockResolvedValue({ items: [show], total: 1 });

      const res = await request(app).get('/api/shows');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [show], pagination: { limit: 20, offset: 0, total: 1 } });
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('passes limit and offset from the query string', async () => {
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app).get('/api/shows?limit=5&offset=10');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], pagination: { limit: 5, offset: 10, total: 0 } });
    });

    it.each([
      { reason: 'eventId', query: `eventId=${show.eventId}`, filters: { eventId: show.eventId } },
      {
        reason: 'screenId',
        query: `screenId=${show.screenId}`,
        filters: { screenId: show.screenId },
      },
      {
        // + must be sent as %2B: a raw + in a query string decodes to a space.
        reason: 'from and to with an encoded offset',
        query: 'from=2026-11-20T00:00:00%2B05:30&to=2026-11-21T00:00:00%2B05:30',
        filters: { from: '2026-11-20T00:00:00+05:30', to: '2026-11-21T00:00:00+05:30' },
      },
    ])('passes $reason to the repository', async ({ query, filters }) => {
      repository.findMany.mockResolvedValue({ items: [show], total: 1 });

      const res = await request(app).get(`/api/shows?${query}`);

      expect(res.status).toBe(200);
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0, ...filters });
      // Filters must not leak into pagination: the contract has only limit, offset and total.
      expect(res.body).toEqual({ data: [show], pagination: { limit: 20, offset: 0, total: 1 } });
    });

    it.each([
      { reason: 'limit is 0', query: 'limit=0' },
      { reason: 'offset is negative', query: 'offset=-1' },
      { reason: 'eventId is not a UUID', query: 'eventId=abc' },
      { reason: 'screenId is not a UUID', query: 'screenId=abc' },
      { reason: 'from has no offset', query: 'from=2026-11-20T00:00:00' },
      { reason: 'the offset + is not encoded', query: 'from=2026-11-20T00:00:00+05:30' },
      {
        reason: 'to is not after from',
        query: 'from=2026-11-21T00:00:00Z&to=2026-11-20T00:00:00Z',
      },
    ])('returns 400 when $reason', async ({ query }) => {
      const res = await request(app).get(`/api/shows?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/shows/:id', () => {
    it('returns 200 with the show', async () => {
      repository.findById.mockResolvedValue(show);

      const res = await request(app).get(showUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: show });
    });

    it('returns 404 when the show does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const res = await request(app).get(showUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });
  });

  describe('POST /api/shows', () => {
    it('returns 201 with the show and a Location header', async () => {
      repository.create.mockResolvedValue(show);

      const res = await request(app).post('/api/shows').send(showInput);

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(showUrl);
      expect(res.body).toEqual({ data: show });
      expect(repository.create).toHaveBeenCalledWith(showInput);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'startsAt has no offset', body: { ...showInput, startsAt: '2026-12-01T14:30:00' } },
      { reason: 'priceMinor is negative', body: { ...showInput, priceMinor: -1 } },
      { reason: 'the body has an id', body: { ...showInput, id: show.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post('/api/shows').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 400 with the field when the event does not exist', async () => {
      repository.create.mockRejectedValue(unknownEvent);

      const res = await request(app).post('/api/shows').send(showInput);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'eventId', message: 'Event does not exist' }],
        },
      });
    });

    it('returns 409 when the show overlaps another show on the screen', async () => {
      repository.create.mockRejectedValue(overlap);

      const res = await request(app).post('/api/shows').send(showInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SHOW_CONFLICT', message: 'Shows on this screen would overlap' },
      });
    });
  });

  describe('PATCH /api/shows/:id', () => {
    const changes = { priceMinor: 0 };

    it('returns 200 with the updated show', async () => {
      repository.update.mockResolvedValue({ ...show, ...changes });

      const res = await request(app).patch(showUrl).send(changes);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...show, ...changes } });
      expect(repository.update).toHaveBeenCalledWith(show.id, changes);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the body has an unknown field', body: { endsAt: '2026-12-01T17:00:00Z' } },
      { reason: 'the body has an id', body: { id: show.id } },
      { reason: 'the body has an eventId', body: { eventId: show.eventId } },
      { reason: 'the body has a screenId', body: { screenId: show.screenId } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).patch(showUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the show does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const res = await request(app).patch(showUrl).send(changes);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });

    it('returns 409 when the new time overlaps another show on the screen', async () => {
      repository.update.mockRejectedValue(overlap);

      const res = await request(app).patch(showUrl).send({ startsAt: '2026-12-01T18:00:00Z' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SHOW_CONFLICT', message: 'Shows on this screen would overlap' },
      });
    });
  });

  describe('DELETE /api/shows/:id', () => {
    it('returns 204 with no body', async () => {
      repository.delete.mockResolvedValue(true);

      const res = await request(app).delete(showUrl);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith(show.id);
    });

    it('returns 404 when the show does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      const res = await request(app).delete(showUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'patch', body: { priceMinor: 0 } },
    { method: 'delete', body: undefined },
  ] as const)('$method returns 400 when the id is not a UUID', async ({ method, body }) => {
    const res = await request(app)[method]('/api/shows/not-a-uuid').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
