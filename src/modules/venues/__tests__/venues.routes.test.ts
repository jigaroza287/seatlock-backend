import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../../app.js';
import { AppError } from '../../../shared/app-error.js';
import type { IVenueRepository } from '../venues.type.js';
import { venue, venueInput } from './venues.fixtures.js';

// Replace the Prisma repository so routes, controller, service and middleware run without a database.
// vi.hoisted lets the vi.mock factory, which runs before imports, use these mocks.
const repository = vi.hoisted(() => ({
  findMany: vi.fn<IVenueRepository['findMany']>(),
  findById: vi.fn<IVenueRepository['findById']>(),
  create: vi.fn<IVenueRepository['create']>(),
  update: vi.fn<IVenueRepository['update']>(),
  delete: vi.fn<IVenueRepository['delete']>(),
}));
vi.mock('../venues.repository.js', () => ({ venueRepository: repository }));
// app.ts also loads the other modules' repositories; stop them creating a real Prisma client.
vi.mock('../../../db/prisma.js', () => ({ prisma: {} }));

const venueUrl = `/api/venues/${venue.id}`;

const conflict = AppError.conflict('Venue', 'A venue with this name already exists in this city');

describe('venues routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/venues', () => {
    it('returns 200 with data and default pagination', async () => {
      repository.findMany.mockResolvedValue({ items: [venue], total: 1 });

      const res = await request(app).get('/api/venues');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [venue], pagination: { limit: 20, offset: 0, total: 1 } });
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it.each([
      { reason: 'search', query: 'search=hall', filters: { search: 'hall' } },
      { reason: 'a trimmed city', query: 'city=%20Pune%20', filters: { city: 'Pune' } },
      {
        reason: 'search, city and paging',
        query: 'search=hall&city=pune&limit=5&offset=10',
        filters: { search: 'hall', city: 'pune', limit: 5, offset: 10 },
      },
    ])('passes $reason to the repository', async ({ query, filters }) => {
      repository.findMany.mockResolvedValue({ items: [], total: 0 });

      const res = await request(app).get(`/api/venues?${query}`);

      expect(res.status).toBe(200);
      expect(repository.findMany).toHaveBeenCalledWith({ limit: 20, offset: 0, ...filters });
    });

    it.each([
      { reason: 'limit is 0', query: 'limit=0' },
      { reason: 'offset is negative', query: 'offset=-1' },
      { reason: 'search is only whitespace', query: 'search=%20%20' },
      { reason: 'city is empty', query: 'city=' },
      { reason: 'city is longer than 100 characters', query: `city=${'a'.repeat(101)}` },
    ])('returns 400 when $reason', async ({ query }) => {
      const res = await request(app).get(`/api/venues?${query}`);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/venues/:id', () => {
    it('returns 200 with the venue', async () => {
      repository.findById.mockResolvedValue(venue);

      const res = await request(app).get(venueUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: venue });
    });

    it('returns 404 when the venue does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const res = await request(app).get(venueUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });
  });

  describe('POST /api/venues', () => {
    it('returns 201 with the venue and a Location header', async () => {
      repository.create.mockResolvedValue(venue);

      const res = await request(app).post('/api/venues').send(venueInput);

      expect(res.status).toBe(201);
      expect(res.headers['location']).toBe(venueUrl);
      expect(res.body).toEqual({ data: venue });
      expect(repository.create).toHaveBeenCalledWith(venueInput);
    });

    it('returns 201 with a null address when the address is omitted', async () => {
      const { name, city } = venueInput;
      repository.create.mockResolvedValue({ ...venue, address: null });

      const res = await request(app).post('/api/venues').send({ name, city });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ data: { ...venue, address: null } });
      expect(repository.create).toHaveBeenCalledWith({ name, city });
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the name is blank', body: { ...venueInput, name: '   ' } },
      { reason: 'the address is null', body: { ...venueInput, address: null } },
      { reason: 'the body has an id', body: { ...venueInput, id: venue.id } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).post('/api/venues').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the name already exists in this city', async () => {
      repository.create.mockRejectedValue(conflict);

      const res = await request(app).post('/api/venues').send(venueInput);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_CONFLICT' } });
    });
  });

  describe('PATCH /api/venues/:id', () => {
    const changes = { name: 'Second hall' };

    it('returns 200 with the updated venue', async () => {
      repository.update.mockResolvedValue({ ...venue, ...changes });

      const res = await request(app).patch(venueUrl).send(changes);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...venue, ...changes } });
      expect(repository.update).toHaveBeenCalledWith(venue.id, changes);
    });

    it('passes a null address through to clear it', async () => {
      repository.update.mockResolvedValue({ ...venue, address: null });

      const res = await request(app).patch(venueUrl).send({ address: null });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...venue, address: null } });
      expect(repository.update).toHaveBeenCalledWith(venue.id, { address: null });
    });

    it.each([
      { reason: 'the body is empty', body: {} },
      { reason: 'the body has an id', body: { id: venue.id } },
      { reason: 'the body has an unknown field', body: { capacity: 200 } },
    ])('returns 400 when $reason', async ({ body }) => {
      const res = await request(app).patch(venueUrl).send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the venue does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const res = await request(app).patch(venueUrl).send(changes);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });

    it('returns 409 when the new name already exists in this city', async () => {
      repository.update.mockRejectedValue(conflict);

      const res = await request(app).patch(venueUrl).send(changes);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_CONFLICT' } });
    });
  });

  describe('DELETE /api/venues/:id', () => {
    it('returns 204 with no body', async () => {
      repository.delete.mockResolvedValue(true);

      const res = await request(app).delete(venueUrl);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(repository.delete).toHaveBeenCalledWith(venue.id);
    });

    it('returns 404 when the venue does not exist', async () => {
      repository.delete.mockResolvedValue(false);

      const res = await request(app).delete(venueUrl);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'VENUE_NOT_FOUND' } });
    });

    it('returns 409 when the venue has screens', async () => {
      repository.delete.mockRejectedValue(AppError.conflict('Venue', 'Venue still has screens'));

      const res = await request(app).delete(venueUrl);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'VENUE_CONFLICT', message: 'Venue still has screens' },
      });
    });
  });

  it.each([
    { method: 'get', body: undefined },
    { method: 'patch', body: { name: 'Second hall' } },
    { method: 'delete', body: undefined },
  ] as const)('$method returns 400 when the id is not a UUID', async ({ method, body }) => {
    const res = await request(app)[method]('/api/venues/not-a-uuid').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});
