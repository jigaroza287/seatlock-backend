import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Event as EventRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import { eventCategorySchema } from './events.schema.js';
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
    category: eventCategorySchema.parse(row.category),
    durationMins: row.durationMins,
    language: row.language,
  };
}

class EventRepository implements IEventRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(query: ListEventsQuery): Promise<EventListOutput> {
    const where = {
      title: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
      category: query.category,
    };

    const [rows, total] = await this.db.$transaction([
      this.db.event.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.event.count({ where }),
    ]);

    return { items: rows.map(toEvent), total };
  }

  async findById(id: string): Promise<Event | null> {
    const row = await this.db.event.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toEvent(row);
  }

  async create(input: CreateEventInput): Promise<Event> {
    const { title, description, category, durationMins, language } = input;
    try {
      const newEvent = await this.db.event.create({
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
      const updatedEvent = await this.db.event.update({ where: { id }, data: changes });
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
      await this.db.event.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Event', 'delete');
    }
  }
}

export const eventRepository: IEventRepository = new EventRepository(prisma);
