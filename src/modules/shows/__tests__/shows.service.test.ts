import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/app-error.js';
import { ShowService } from '../shows.service.js';
import type { IShowRepository, ListShowsQuery } from '../shows.type.js';
import { seatMap, show, showInput, showSeatViews } from './shows.fixtures.js';

// shows.service.ts creates the real singleton on import, which loads Prisma and needs DATABASE_URL.
vi.mock('../shows.repository.js', () => ({ showRepository: {} }));

const notFound = { statusCode: 404, code: 'SHOW_NOT_FOUND' };

describe('ShowService', () => {
  const findMany = vi.fn<IShowRepository['findMany']>();
  const findById = vi.fn<IShowRepository['findById']>();
  const findSeatMap = vi.fn<IShowRepository['findSeatMap']>();
  const create = vi.fn<IShowRepository['create']>();
  const update = vi.fn<IShowRepository['update']>();
  const remove = vi.fn<IShowRepository['delete']>();

  const repository: IShowRepository = {
    findMany,
    findById,
    findSeatMap,
    create,
    update,
    delete: remove,
  };
  const service = new ShowService(repository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('returns the items and total from the repository', async () => {
      const query: ListShowsQuery = { limit: 20, offset: 0, eventId: show.eventId };
      findMany.mockResolvedValue({ items: [show], total: 1 });

      await expect(service.list(query)).resolves.toEqual({ items: [show], total: 1 });
      expect(findMany).toHaveBeenCalledWith(query);
    });
  });

  describe('getById', () => {
    it('returns the show when it exists', async () => {
      findById.mockResolvedValue(show);

      await expect(service.getById(show.id)).resolves.toEqual(show);
      expect(findById).toHaveBeenCalledWith(show.id);
    });

    it('throws SHOW_NOT_FOUND when the show does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById(show.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('getSeatMap', () => {
    it('returns the seats grouped into rows', async () => {
      findSeatMap.mockResolvedValue([...showSeatViews]);

      await expect(service.getSeatMap(show.id)).resolves.toEqual(seatMap);
      expect(findSeatMap).toHaveBeenCalledWith(show.id);
    });

    it('throws SHOW_NOT_FOUND when the show does not exist', async () => {
      findSeatMap.mockResolvedValue(null);

      await expect(service.getSeatMap(show.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('create', () => {
    it('returns the created show', async () => {
      create.mockResolvedValue(show);

      await expect(service.create(showInput)).resolves.toEqual(show);
      expect(create).toHaveBeenCalledWith(showInput);
    });

    it('passes repository errors through unchanged', async () => {
      const conflict = AppError.conflict('Show', 'This screen already has a show at this time');
      create.mockRejectedValue(conflict);

      await expect(service.create(showInput)).rejects.toBe(conflict);
    });
  });

  describe('update', () => {
    it('returns the updated show', async () => {
      const changes = { priceMinor: 0 };
      update.mockResolvedValue({ ...show, ...changes });

      await expect(service.update(show.id, changes)).resolves.toEqual({ ...show, ...changes });
      expect(update).toHaveBeenCalledWith(show.id, changes);
    });

    it('throws SHOW_NOT_FOUND when the show does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(service.update(show.id, { priceMinor: 0 })).rejects.toMatchObject(notFound);
    });
  });

  describe('remove', () => {
    it('resolves when the show is deleted', async () => {
      remove.mockResolvedValue(true);

      await expect(service.remove(show.id)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(show.id);
    });

    it('throws SHOW_NOT_FOUND when the show does not exist', async () => {
      remove.mockResolvedValue(false);

      await expect(service.remove(show.id)).rejects.toMatchObject(notFound);
    });
  });
});
