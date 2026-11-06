import { randomUUID } from 'crypto';
import { prisma } from '../../db/prisma.js';
import type { Event as EventRow } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/app-error.js';
import { CategorySchema } from './events.schema.js';
import type {
  CreateEventInput,
  Event,
  EventListOutput,
  IEventRepository,
  ListEventsQuery,
  UpdateEventInput,
} from './events.type.js';

function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: CategorySchema.parse(row.category),
    durationMins: row.durationMins,
    language: row.language,
  };
}

class EventRepository implements IEventRepository {
  #events = new Map<string, Event>();
  #isTitleTaken(title: string, excludeId?: string): boolean {
    for (const event of this.#events.values()) {
      if (event.id !== excludeId && event.title.toLowerCase() === title.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  async findMany(query: ListEventsQuery): Promise<EventListOutput> {
    const where = {
      title: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
      category: query.category,
    };

    const [rows, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.event.count({ where }),
    ]);

    return { items: rows.map(toEvent), total };
  }

  async findById(id: string): Promise<Event | null> {
    const row = await prisma.event.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toEvent(row);
  }

  create(input: CreateEventInput): Promise<Event> {
    if (this.#isTitleTaken(input.title)) {
      return Promise.reject(
        AppError.conflict('Event', `Title '${input.title}' is already used by another event`)
      );
    }

    const id = randomUUID();
    const event: Event = {
      id,
      ...input,
    };
    this.#events.set(id, event);
    return Promise.resolve(event);
  }

  update(id: string, changes: UpdateEventInput): Promise<Event | null> {
    const existingEvent = this.#events.get(id);
    if (existingEvent !== undefined) {
      if (changes.title) {
        if (this.#isTitleTaken(changes.title, id)) {
          return Promise.reject(
            AppError.conflict('Event', `Title '${changes.title}' is already used by another event`)
          );
        }
      }
      const updatedEvent = {
        ...existingEvent,
        ...changes,
      };
      this.#events.set(id, updatedEvent);
      return Promise.resolve(updatedEvent);
    }

    return Promise.resolve(null);
  }

  delete(id: string): Promise<boolean> {
    if (this.#events.has(id)) {
      this.#events.delete(id);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
}

export const eventRepository: IEventRepository = new EventRepository();
