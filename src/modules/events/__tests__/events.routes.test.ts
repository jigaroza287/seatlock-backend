import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app.js';
import { AppError } from '../../../shared/app-error.js';
import type { IEventRepository } from '../events.type.js';
import { event, eventInput } from './events.fixtures.js';

// Replace the Prisma repository so routes, controller, service and middleware run without a database.
// vi.hoisted lets the vi.mock factory, which runs before imports, use these mocks.
const repository = vi.hoisted(() => ({
  findMany: vi.fn<IEventRepository['findMany']>(),
  findById: vi.fn<IEventRepository['findById']>(),
  create: vi.fn<IEventRepository['create']>(),
  update: vi.fn<IEventRepository['update']>(),
  delete: vi.fn<IEventRepository['delete']>(),
}));
vi.mock('../events.repository.js', () => ({ eventRepository: repository }));
// app.ts also loads the other modules' repositories; stop them creating a real Prisma client.
vi.mock('../../../db/prisma.js', () => ({ prisma: {} }));

const eventUrl = `/api/events/${event.id}`;

const conflict = AppError.conflict('Event', 'An event with this title already exists');

describe('events routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/events', () => {
    it('returns 200 with data and default pagination', async () => {
      repository.findMany.mockResolvedValue({ items: [event], total: 1 });

      const res = await request(app).get('/api/events');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [event], pagination: { limit: 20, offset: 0, total: 1 } });
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('passes limit and offset from the query string', async () => {
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app).get('/api/events?limit=5&offset=10');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], pagination: { limit: 5, offset: 10, total: 0 } });
    });

    it.each([
      { reason: 'search', query: 'search=stand-up', filters: { search: 'stand-up' } },
      {
        reason: 'a trimmed search',
        query: 'search=%20%20stand-up%20%20',
        filters: { search: 'stand-up' },
      },
      { reason: 'category', query: 'category=comedy', filters: { category: 'comedy' } },
      {
        reason: 'search and category',
        query: 'search=night&category=comedy',
        filters: { search: 'night', category: 'comedy' },
      },
    ])('passes $reason to the repository', async ({ query, filters }) => {
      repository.findMany.mockResolvedValue({ items: [event], total: 1 });

      const res = await request(app).get(`/api/events?${query}`);

      expect(res.status).toBe(200);
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0, ...filters });
      // Filters must not leak into pagination: the contract has only limit, offset and total.
      expect(res.body).toEqual({ data: [event], pagination: { limit: 20, offset: 0, total: 1 } });
    });

    it.each([
      { reason: 'limit is 0', query: 'limit=0' },
      { reason: 'limit is above 100', query: 'limit=101' },
      { reason: 'offset is negative', query: 'offset=-1' },
      { reason: 'limit is not a number', query: 'limit=abc' },
      { reason: 'search is empty', query: 'search=' },
      { reason: 'search is only whitespace', query: 'search=%20%20%20' },
      { reason: 'search is longer than 100 characters', query: `search=${'a'.repeat(101)}` },
      { reason: 'category is unknown', query: 'category=opera' },
    ])('returns 400 when $reason', async ({ query }) => {
      const res = await request(app).get(`/api/events?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/events/:id', () => {
    it('returns 200 with the event', async () => {
      repository.findById.mockResolvedValue(event);

      const res = await request(app).get(eventUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: event });
    });

    it('returns 404 when the event does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const res = await request(app).get(eventUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_NOT_FOUND' } });
    });
  });

  describe('POST /api/events', () => {
    it('returns 201 with the event and a Location header', async () => {
      repository.create.mockResolvedValue(event);

      const res = await request(app).post('/api/events').send(eventInput);

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(eventUrl);
      expect(res.body).toEqual({ data: event });
      expect(repository.create).toHaveBeenCalledWith(eventInput);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the title is blank', body: { ...eventInput, title: '   ' } },
      { reason: 'the category is unknown', body: { ...eventInput, category: 'opera' } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post('/api/events').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Content-Type', 'application/json')
        .send('{"title":');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' },
      });
    });

    it('returns 409 when the title already exists', async () => {
      repository.create.mockRejectedValue(conflict);

      const res = await request(app).post('/api/events').send(eventInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_CONFLICT' } });
    });
  });

  describe('PATCH /api/events/:id', () => {
    const changes = { title: 'Late-night stand-up' };

    it('returns 200 with the updated event', async () => {
      repository.update.mockResolvedValue({ ...event, ...changes });

      const res = await request(app).patch(eventUrl).send(changes);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...event, ...changes } });
      expect(repository.update).toHaveBeenCalledWith(event.id, changes);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the body has an id', body: { id: event.id } },
      { reason: 'the body has an unknown field', body: { venue: 'Main hall' } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).patch(eventUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the event does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const res = await request(app).patch(eventUrl).send(changes);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_NOT_FOUND' } });
    });

    it('returns 409 when the new title already exists', async () => {
      repository.update.mockRejectedValue(conflict);

      const res = await request(app).patch(eventUrl).send(changes);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_CONFLICT' } });
    });

    // What toAppError returns when the shows' new endsAt hits shows_no_overlap.
    it('returns 409 when a new durationMins makes shows overlap', async () => {
      repository.update.mockRejectedValue(
        AppError.conflict('Event', 'Shows on this screen would overlap')
      );

      const res = await request(app).patch(eventUrl).send({ durationMins: 180 });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'EVENT_CONFLICT', message: 'Shows on this screen would overlap' },
      });
      expect(repository.update).toHaveBeenCalledWith(event.id, { durationMins: 180 });
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('returns 204 with no body', async () => {
      repository.delete.mockResolvedValue(true);

      const res = await request(app).delete(eventUrl);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith(event.id);
    });

    it('returns 404 when the event does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      const res = await request(app).delete(eventUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'EVENT_NOT_FOUND' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'patch', body: { title: 'Late-night stand-up' } },
    { method: 'delete', body: undefined },
  ] as const)('$method returns 400 when the id is not a UUID', async ({ method, body }) => {
    const res = await request(app)[method]('/api/events/not-a-uuid').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'ROUTE_NOT_FOUND' } });
  });

  it('echoes the X-Request-Id header in the error body', async () => {
    repository.findById.mockResolvedValue(null);

    const res = await request(app).get(eventUrl).set('X-Request-Id', 'test-request-id');

    expect(res.headers['x-request-id']).toBe('test-request-id');
    expect(res.body).toMatchObject({ error: { requestId: 'test-request-id' } });
  });
});
