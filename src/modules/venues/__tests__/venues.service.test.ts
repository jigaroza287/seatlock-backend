import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/app-error.js';
import { VenueService } from '../venues.service.js';
import type { IVenueRepository, ListVenuesQuery } from '../venues.type.js';
import { venue, venueInput } from './venues.fixtures.js';

// venues.service.ts creates the real singleton on import, which loads Prisma and needs DATABASE_URL.
vi.mock('../venues.repository.js', () => ({ venueRepository: {} }));

const notFound = { statusCode: 404, code: 'VENUE_NOT_FOUND' };

describe('VenueService', () => {
  const findMany = vi.fn<IVenueRepository['findMany']>();
  const findById = vi.fn<IVenueRepository['findById']>();
  const create = vi.fn<IVenueRepository['create']>();
  const update = vi.fn<IVenueRepository['update']>();
  const remove = vi.fn<IVenueRepository['delete']>();

  const repository: IVenueRepository = { findMany, findById, create, update, delete: remove };
  const service = new VenueService(repository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('returns the items and total from the repository', async () => {
      const query: ListVenuesQuery = { limit: 20, offset: 0, city: 'Pune' };
      findMany.mockResolvedValue({ items: [venue], total: 1 });

      await expect(service.list(query)).resolves.toEqual({ items: [venue], total: 1 });
      expect(findMany).toHaveBeenCalledWith(query);
    });
  });

  describe('getById', () => {
    it('returns the venue when it exists', async () => {
      findById.mockResolvedValue(venue);

      await expect(service.getById(venue.id)).resolves.toEqual(venue);
      expect(findById).toHaveBeenCalledWith(venue.id);
    });

    it('throws VENUE_NOT_FOUND when the venue does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById(venue.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('create', () => {
    it('returns the created venue', async () => {
      create.mockResolvedValue(venue);

      await expect(service.create(venueInput)).resolves.toEqual(venue);
      expect(create).toHaveBeenCalledWith(venueInput);
    });

    it('passes repository errors through unchanged', async () => {
      const conflict = AppError.conflict(
        'Venue',
        'A venue with this name already exists in this city'
      );
      create.mockRejectedValue(conflict);

      await expect(service.create(venueInput)).rejects.toBe(conflict);
    });
  });

  describe('update', () => {
    it('returns the updated venue', async () => {
      const changes = { address: null };
      update.mockResolvedValue({ ...venue, ...changes });

      await expect(service.update(venue.id, changes)).resolves.toEqual({ ...venue, ...changes });
      expect(update).toHaveBeenCalledWith(venue.id, changes);
    });

    it('throws VENUE_NOT_FOUND when the venue does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(service.update(venue.id, { name: 'Any name' })).rejects.toMatchObject(notFound);
    });
  });

  describe('remove', () => {
    it('resolves when the venue is deleted', async () => {
      remove.mockResolvedValue(true);

      await expect(service.remove(venue.id)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(venue.id);
    });

    it('throws VENUE_NOT_FOUND when the venue does not exist', async () => {
      remove.mockResolvedValue(false);

      await expect(service.remove(venue.id)).rejects.toMatchObject(notFound);
    });

    it('passes the dependent-rows conflict through unchanged', async () => {
      const conflict = AppError.conflict('Venue', 'Venue still has screens');
      remove.mockRejectedValue(conflict);

      await expect(service.remove(venue.id)).rejects.toBe(conflict);
    });
  });
});
