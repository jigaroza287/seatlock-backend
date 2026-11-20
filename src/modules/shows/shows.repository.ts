import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Show as ShowRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import type {
  CreateShowInput,
  IShowRepository,
  ListShowsQuery,
  Show,
  ShowListOutput,
  UpdateShowInput,
} from './shows.type.js';

function toShow(row: ShowRow): Show {
  return {
    id: row.id,
    eventId: row.eventId,
    screenId: row.screenId,
    startsAt: row.startsAt.toISOString(),
    priceMinor: row.priceMinor,
  };
}

function toDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

class ShowRepository implements IShowRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(query: ListShowsQuery): Promise<ShowListOutput> {
    // Half-open range: from is inclusive, to is exclusive.
    const where = {
      eventId: query.eventId,
      screenId: query.screenId,
      startsAt: { gte: toDate(query.from), lt: toDate(query.to) },
    };

    const [rows, total] = await this.db.$transaction([
      this.db.show.findMany({
        where,
        // startsAt is only unique per screen, so id breaks ties for stable pages.
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.show.count({ where }),
    ]);

    return { items: rows.map(toShow), total };
  }

  async findById(id: string): Promise<Show | null> {
    const row = await this.db.show.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toShow(row);
  }

  // A missing event or screen fails on its FK, which toAppError maps to 400 with the field.
  async create(input: CreateShowInput): Promise<Show> {
    const { eventId, screenId, startsAt, priceMinor } = input;
    try {
      const newShow = await this.db.show.create({
        data: {
          eventId,
          screenId,
          startsAt: new Date(startsAt),
          priceMinor,
        },
      });
      return toShow(newShow);
    } catch (error: unknown) {
      throw toAppError(error, 'Show', 'create');
    }
  }

  async update(id: string, changes: UpdateShowInput): Promise<Show | null> {
    const { startsAt, ...rest } = changes;
    try {
      const updatedShow = await this.db.show.update({
        where: { id },
        data: { ...rest, startsAt: toDate(startsAt) },
      });
      return toShow(updatedShow);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw toAppError(error, 'Show', 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.show.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Show', 'delete');
    }
  }
}

export const showRepository: IShowRepository = new ShowRepository(prisma);
