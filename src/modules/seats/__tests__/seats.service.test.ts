import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/app-error.js';
import { screen } from '../../screens/__tests__/screens.fixtures.js';
import type { IScreenRepository } from '../../screens/screens.type.js';
import { SeatService } from '../seats.service.js';
import type { ISeatRepository, ListSeatsQuery } from '../seats.type.js';
import { seat, seatInput } from './seats.fixtures.js';

// seats.service.ts creates the real singleton on import, which loads Prisma and needs DATABASE_URL.
vi.mock('../seats.repository.js', () => ({ seatRepository: {} }));
vi.mock('../../screens/screens.repository.js', () => ({ screenRepository: {} }));

const notFound = { statusCode: 404, code: 'SEAT_NOT_FOUND' };
const screenNotFound = { statusCode: 404, code: 'SCREEN_NOT_FOUND' };

describe('SeatService', () => {
  const findMany = vi.fn<ISeatRepository['findMany']>();
  const findById = vi.fn<ISeatRepository['findById']>();
  const create = vi.fn<ISeatRepository['create']>();
  const update = vi.fn<ISeatRepository['update']>();
  const remove = vi.fn<ISeatRepository['delete']>();
  const findScreenById = vi.fn<IScreenRepository['findById']>();

  const repository: ISeatRepository = { findMany, findById, create, update, delete: remove };
  // Only findById is used by the seat service.
  const screenRepository: IScreenRepository = {
    findMany: vi.fn<IScreenRepository['findMany']>(),
    findById: findScreenById,
    create: vi.fn<IScreenRepository['create']>(),
    update: vi.fn<IScreenRepository['update']>(),
    delete: vi.fn<IScreenRepository['delete']>(),
  };
  const service = new SeatService(repository, screenRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    const query: ListSeatsQuery = { limit: 20, offset: 0 };

    it('returns the screen seats when the screen exists', async () => {
      findScreenById.mockResolvedValue(screen);
      findMany.mockResolvedValue({ items: [seat], total: 1 });

      await expect(service.list(screen.id, query)).resolves.toEqual({ items: [seat], total: 1 });
      expect(findScreenById).toHaveBeenCalledWith(screen.id);
      expect(findMany).toHaveBeenCalledWith(screen.id, query);
    });

    it('throws SCREEN_NOT_FOUND without listing when the screen does not exist', async () => {
      findScreenById.mockResolvedValue(null);

      await expect(service.list(screen.id, query)).rejects.toMatchObject(screenNotFound);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the seat when it exists', async () => {
      findById.mockResolvedValue(seat);

      await expect(service.getById(seat.id)).resolves.toEqual(seat);
      expect(findById).toHaveBeenCalledWith(seat.id);
    });

    it('throws SEAT_NOT_FOUND when the seat does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById(seat.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('create', () => {
    it('returns the created seat without looking up the screen', async () => {
      create.mockResolvedValue(seat);

      await expect(service.create(screen.id, seatInput)).resolves.toEqual(seat);
      expect(create).toHaveBeenCalledWith(screen.id, seatInput);
      expect(findScreenById).not.toHaveBeenCalled();
    });

    it.each([
      {
        reason: 'SCREEN_NOT_FOUND',
        error: AppError.notFound('Screen', 'Screen does not exist'),
      },
      {
        reason: 'SEAT_CONFLICT',
        error: AppError.conflict('Seat', 'This seat already exists on this screen'),
      },
    ])('passes $reason from the repository through unchanged', async ({ error }) => {
      create.mockRejectedValue(error);

      await expect(service.create(screen.id, seatInput)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('returns the updated seat', async () => {
      const changes = { category: 'premium' as const };
      update.mockResolvedValue({ ...seat, ...changes });

      await expect(service.update(seat.id, changes)).resolves.toEqual({ ...seat, ...changes });
      expect(update).toHaveBeenCalledWith(seat.id, changes);
    });

    it('throws SEAT_NOT_FOUND when the seat does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(service.update(seat.id, { seatNumber: 2 })).rejects.toMatchObject(notFound);
    });
  });

  describe('remove', () => {
    it('resolves when the seat is deleted', async () => {
      remove.mockResolvedValue(true);

      await expect(service.remove(seat.id)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(seat.id);
    });

    it('throws SEAT_NOT_FOUND when the seat does not exist', async () => {
      remove.mockResolvedValue(false);

      await expect(service.remove(seat.id)).rejects.toMatchObject(notFound);
    });
  });
});
