import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app.js';
import { AppError } from '../../../shared/app-error.js';
import { venue } from '../../venues/__tests__/venues.fixtures.js';
import type { IVenueRepository } from '../../venues/venues.type.js';
import type { IScreenRepository } from '../screens.type.js';
import { screen, screenInput } from './screens.fixtures.js';

// Replace the Prisma repositories so routes, controller, service and middleware run without a database.
// vi.hoisted lets the vi.mock factories, which run before imports, use these mocks.
const { repository, venueRepository } = vi.hoisted(() => ({
  repository: {
    findMany: vi.fn<IScreenRepository['findMany']>(),
    findById: vi.fn<IScreenRepository['findById']>(),
    create: vi.fn<IScreenRepository['create']>(),
    update: vi.fn<IScreenRepository['update']>(),
    delete: vi.fn<IScreenRepository['delete']>(),
  },
  venueRepository: {
    findMany: vi.fn<IVenueRepository['findMany']>(),
    findById: vi.fn<IVenueRepository['findById']>(),
    create: vi.fn<IVenueRepository['create']>(),
    update: vi.fn<IVenueRepository['update']>(),
    delete: vi.fn<IVenueRepository['delete']>(),
  },
}));
vi.mock('../screens.repository.js', () => ({ screenRepository: repository }));
// The screen service looks up the venue before listing.
vi.mock('../../venues/venues.repository.js', () => ({ venueRepository }));
// app.ts also loads the other modules' repositories; stop them creating a real Prisma client.
vi.mock('../../../db/prisma.js', () => ({ prisma: {} }));

const venueScreensUrl = `/api/venues/${venue.id}/screens`;
const screenUrl = `/api/screens/${screen.id}`;

const conflict = AppError.conflict(
  'Screen',
  'A screen with this name already exists at this venue'
);

describe('screens routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/venues/:venueId/screens', () => {
    it('returns 200 with data and default pagination', async () => {
      venueRepository.findById.mockResolvedValue(venue);
      repository.findMany.mockResolvedValue({ items: [screen], total: 1 });

      const res = await request(app).get(venueScreensUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [screen], pagination: { limit: 20, offset: 0, total: 1 } });
      expect(repository.findMany).toHaveBeenCalledWith(venue.id, { limit: 20, offset: 0 });
    });

    it('passes limit and offset from the query string', async () => {
      venueRepository.findById.mockResolvedValue(venue);
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app).get(`${venueScreensUrl}?limit=5&offset=10`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], pagination: { limit: 5, offset: 10, total: 0 } });
      expect(repository.findMany).toHaveBeenCalledWith(venue.id, { limit: 5, offset: 10 });
    });

    it.each([
      { reason: 'limit is 0', query: 'limit=0' },
      { reason: 'limit is above 100', query: 'limit=101' },
      { reason: 'offset is negative', query: 'offset=-1' },
      { reason: 'limit is not a number', query: 'limit=abc' },
    ])('returns 400 when $reason', async ({ query }) => {
      const res = await request(app).get(`${venueScreensUrl}?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the venue does not exist', async () => {
      venueRepository.findById.mockResolvedValue(null);

      const res = await request(app).get(venueScreensUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/venues/:venueId/screens', () => {
    it('returns 201 with the screen and a Location header to the flat route', async () => {
      repository.create.mockResolvedValue(screen);

      const res = await request(app).post(venueScreensUrl).send(screenInput);

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(screenUrl);
      expect(res.body).toEqual({ data: screen });
      expect(repository.create).toHaveBeenCalledWith(venue.id, screenInput);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the name is blank', body: { name: '   ' } },
      { reason: 'the name is longer than 100 characters', body: { name: 'a'.repeat(101) } },
      { reason: 'the body has venueId', body: { ...screenInput, venueId: venue.id } },
      { reason: 'the body has id', body: { ...screenInput, id: screen.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post(venueScreensUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the venue does not exist', async () => {
      repository.create.mockRejectedValue(AppError.notFound('Venue', 'Venue does not exist'));

      const res = await request(app).post(venueScreensUrl).send(screenInput);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });

    it('returns 409 when the name already exists at this venue', async () => {
      repository.create.mockRejectedValue(conflict);

      const res = await request(app).post(venueScreensUrl).send(screenInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_CONFLICT' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'post', body: screenInput },
  ] as const)(
    '$method on the nested route returns 400 when the venue id is not a UUID',
    async ({ method, body }) => {
      const res = await request(app)[method]('/api/venues/not-a-uuid/screens').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(venueRepository.findById).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    }
  );

  describe('GET /api/screens/:id', () => {
    it('returns 200 with the screen', async () => {
      repository.findById.mockResolvedValue(screen);

      const res = await request(app).get(screenUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: screen });
    });

    it('returns 404 when the screen does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const res = await request(app).get(screenUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });
  });

  describe('PATCH /api/screens/:id', () => {
    const changes = { name: 'Screen 2' };

    it('returns 200 with the updated screen', async () => {
      repository.update.mockResolvedValue({ ...screen, ...changes });

      const res = await request(app).patch(screenUrl).send(changes);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...screen, ...changes } });
      expect(repository.update).toHaveBeenCalledWith(screen.id, changes);
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the body has an unknown field', body: { capacity: 100 } },
      { reason: 'the body has venueId', body: { venueId: venue.id } },
      { reason: 'the body has id', body: { id: screen.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).patch(screenUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the screen does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const res = await request(app).patch(screenUrl).send(changes);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    it('returns 409 when the new name already exists at this venue', async () => {
      repository.update.mockRejectedValue(conflict);

      const res = await request(app).patch(screenUrl).send(changes);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_CONFLICT' } });
    });
  });

  describe('DELETE /api/screens/:id', () => {
    it('returns 204 with no body', async () => {
      repository.delete.mockResolvedValue(true);

      const res = await request(app).delete(screenUrl);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith(screen.id);
    });

    it('returns 404 when the screen does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      const res = await request(app).delete(screenUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_NOT_FOUND' } });
    });

    it('returns 409 when the screen has shows', async () => {
      repository.delete.mockRejectedValue(
        AppError.conflict('Screen', 'Screen has scheduled shows')
      );

      const res = await request(app).delete(screenUrl);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'SCREEN_CONFLICT' } });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'patch', body: { name: 'Screen 2' } },
    { method: 'delete', body: undefined },
  ] as const)('$method returns 400 when the screen id is not a UUID', async ({ method, body }) => {
    const res = await request(app)[method]('/api/screens/not-a-uuid').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
