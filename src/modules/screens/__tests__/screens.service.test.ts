import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/app-error.js';
import { venue } from '../../venues/__tests__/venues.fixtures.js';
import type { IVenueRepository } from '../../venues/venues.type.js';
import { ScreenService } from '../screens.service.js';
import type { IScreenRepository, ListScreensQuery } from '../screens.type.js';
import { screen, screenInput } from './screens.fixtures.js';

// screens.service.ts creates the real singleton on import, which loads Prisma and needs DATABASE_URL.
vi.mock('../screens.repository.js', () => ({ screenRepository: {} }));
vi.mock('../../venues/venues.repository.js', () => ({ venueRepository: {} }));

const notFound = { statusCode: 404, code: 'SCREEN_NOT_FOUND' };
const venueNotFound = { statusCode: 404, code: 'VENUE_NOT_FOUND' };

describe('ScreenService', () => {
  const findMany = vi.fn<IScreenRepository['findMany']>();
  const findById = vi.fn<IScreenRepository['findById']>();
  const create = vi.fn<IScreenRepository['create']>();
  const update = vi.fn<IScreenRepository['update']>();
  const remove = vi.fn<IScreenRepository['delete']>();
  const findVenueById = vi.fn<IVenueRepository['findById']>();

  const repository: IScreenRepository = { findMany, findById, create, update, delete: remove };
  // Only findById is used by the screen service.
  const venueRepository: IVenueRepository = {
    findMany: vi.fn<IVenueRepository['findMany']>(),
    findById: findVenueById,
    create: vi.fn<IVenueRepository['create']>(),
    update: vi.fn<IVenueRepository['update']>(),
    delete: vi.fn<IVenueRepository['delete']>(),
  };
  const service = new ScreenService(repository, venueRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    const query: ListScreensQuery = { limit: 20, offset: 0 };

    it('returns the venue screens when the venue exists', async () => {
      findVenueById.mockResolvedValue(venue);
      findMany.mockResolvedValue({ items: [screen], total: 1 });

      await expect(service.list(venue.id, query)).resolves.toEqual({ items: [screen], total: 1 });
      expect(findVenueById).toHaveBeenCalledWith(venue.id);
      expect(findMany).toHaveBeenCalledWith(venue.id, query);
    });

    it('throws VENUE_NOT_FOUND without listing when the venue does not exist', async () => {
      findVenueById.mockResolvedValue(null);

      await expect(service.list(venue.id, query)).rejects.toMatchObject(venueNotFound);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the screen when it exists', async () => {
      findById.mockResolvedValue(screen);

      await expect(service.getById(screen.id)).resolves.toEqual(screen);
      expect(findById).toHaveBeenCalledWith(screen.id);
    });

    it('throws SCREEN_NOT_FOUND when the screen does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById(screen.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('create', () => {
    it('returns the created screen without looking up the venue', async () => {
      create.mockResolvedValue(screen);

      await expect(service.create(venue.id, screenInput)).resolves.toEqual(screen);
      expect(create).toHaveBeenCalledWith(venue.id, screenInput);
      expect(findVenueById).not.toHaveBeenCalled();
    });

    it.each([
      {
        reason: 'VENUE_NOT_FOUND',
        error: AppError.notFound('Venue', 'Venue does not exist'),
      },
      {
        reason: 'SCREEN_CONFLICT',
        error: AppError.conflict('Screen', 'A screen with this name already exists at this venue'),
      },
    ])('passes $reason from the repository through unchanged', async ({ error }) => {
      create.mockRejectedValue(error);

      await expect(service.create(venue.id, screenInput)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('returns the updated screen', async () => {
      const changes = { name: 'Screen 2' };
      update.mockResolvedValue({ ...screen, ...changes });

      await expect(service.update(screen.id, changes)).resolves.toEqual({ ...screen, ...changes });
      expect(update).toHaveBeenCalledWith(screen.id, changes);
    });

    it('throws SCREEN_NOT_FOUND when the screen does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(service.update(screen.id, { name: 'Screen 2' })).rejects.toMatchObject(notFound);
    });
  });

  describe('remove', () => {
    it('resolves when the screen is deleted', async () => {
      remove.mockResolvedValue(true);

      await expect(service.remove(screen.id)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(screen.id);
    });

    it('throws SCREEN_NOT_FOUND when the screen does not exist', async () => {
      remove.mockResolvedValue(false);

      await expect(service.remove(screen.id)).rejects.toMatchObject(notFound);
    });
  });
});
