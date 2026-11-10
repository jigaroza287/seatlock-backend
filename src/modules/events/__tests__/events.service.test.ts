import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/app-error.js';
import { EventService } from '../events.service.js';
import type { IEventRepository, ListEventsQuery } from '../events.type.js';
import { event, eventInput } from './events.fixtures.js';

// events.service.ts creates the real singleton on import, which loads Prisma and needs DATABASE_URL.
vi.mock('../events.repository.js', () => ({ eventRepository: {} }));

const notFound = { statusCode: 404, code: 'EVENT_NOT_FOUND' };

describe('EventService', () => {
  const findMany = vi.fn<IEventRepository['findMany']>();
  const findById = vi.fn<IEventRepository['findById']>();
  const create = vi.fn<IEventRepository['create']>();
  const update = vi.fn<IEventRepository['update']>();
  const remove = vi.fn<IEventRepository['delete']>();

  const repository: IEventRepository = { findMany, findById, create, update, delete: remove };
  const service = new EventService(repository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('list', () => {
    it('returns the items and total from the repository', async () => {
      const query: ListEventsQuery = { limit: 20, offset: 0 };
      findMany.mockResolvedValue({ items: [event], total: 1 });

      await expect(service.list(query)).resolves.toEqual({ items: [event], total: 1 });
      expect(findMany).toHaveBeenCalledWith(query);
    });
  });

  describe('getById', () => {
    it('returns the event when it exists', async () => {
      findById.mockResolvedValue(event);

      await expect(service.getById(event.id)).resolves.toEqual(event);
      expect(findById).toHaveBeenCalledWith(event.id);
    });

    it('throws EVENT_NOT_FOUND when the event does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById(event.id)).rejects.toMatchObject(notFound);
    });
  });

  describe('create', () => {
    it('returns the created event', async () => {
      create.mockResolvedValue(event);

      await expect(service.create(eventInput)).resolves.toEqual(event);
      expect(create).toHaveBeenCalledWith(eventInput);
    });

    it('passes repository errors through unchanged', async () => {
      const conflict = AppError.conflict('Event', 'An event with this title already exists');
      create.mockRejectedValue(conflict);

      await expect(service.create(eventInput)).rejects.toBe(conflict);
    });
  });

  describe('update', () => {
    it('returns the updated event', async () => {
      const changes = { title: 'Late-night stand-up' };
      update.mockResolvedValue({ ...event, ...changes });

      await expect(service.update(event.id, changes)).resolves.toEqual({ ...event, ...changes });
      expect(update).toHaveBeenCalledWith(event.id, changes);
    });

    it('throws EVENT_NOT_FOUND when the event does not exist', async () => {
      update.mockResolvedValue(null);

      await expect(service.update(event.id, { title: 'Any title' })).rejects.toMatchObject(
        notFound
      );
    });
  });

  describe('remove', () => {
    it('resolves when the event is deleted', async () => {
      remove.mockResolvedValue(true);

      await expect(service.remove(event.id)).resolves.toBeUndefined();
      expect(remove).toHaveBeenCalledWith(event.id);
    });

    it('throws EVENT_NOT_FOUND when the event does not exist', async () => {
      remove.mockResolvedValue(false);

      await expect(service.remove(event.id)).rejects.toMatchObject(notFound);
    });
  });
});
