import { prisma } from '../../db/prisma.js';
import { type Event as EventRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
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

  async create(input: CreateEventInput): Promise<Event> {
    const { title, description, category, durationMins, language } = input;
    try {
      const newEvent = await prisma.event.create({
        data: {
          title,
          description,
          category,
          durationMins,
          language,
        },
      });
      return toEvent(newEvent);
    } catch (error: unknown) {
      throw toAppError(error, 'Event', 'create');
    }
  }

  async update(id: string, changes: UpdateEventInput): Promise<Event | null> {
    try {
      const updatedEvent = await prisma.event.update({ where: { id }, data: changes });
      return toEvent(updatedEvent);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw toAppError(error, 'Event', 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.event.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Event', 'delete');
    }
  }
}

export const eventRepository: IEventRepository = new EventRepository();
