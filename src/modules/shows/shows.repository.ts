import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Show as ShowRow } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/app-error.js';
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
    endsAt: row.endsAt.toISOString(),
    priceMinor: row.priceMinor,
  };
}

function toDate(value: string | undefined): Date | undefined {
  return value === undefined ? undefined : new Date(value);
}

function toEndsAt(startsAt: Date, durationMins: number): Date {
  return new Date(startsAt.getTime() + durationMins * 60 * 1000);
}

type DurationRow = { durationMins: number };

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

  // endsAt = startsAt + event duration. The event row is read FOR SHARE so an event PATCH
  // that changes durationMins waits for this show to commit, then updates its endsAt too.
  // A missing screen fails on its FK, which toAppError maps to 400 with the field.
  async create(input: CreateShowInput): Promise<Show> {
    const { eventId, screenId, startsAt, priceMinor } = input;
    try {
      const newShow = await this.db.$transaction(async (tx) => {
        const [event] = await tx.$queryRaw<DurationRow[]>`
          SELECT duration_mins AS "durationMins"
          FROM events
          WHERE id = ${eventId}::uuid
          FOR SHARE
        `;
        if (!event) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', [
            { field: 'eventId', message: 'Event does not exist' },
          ]);
        }

        const startDate = new Date(startsAt);
        return tx.show.create({
          data: {
            eventId,
            screenId,
            startsAt: startDate,
            endsAt: toEndsAt(startDate, event.durationMins),
            priceMinor,
          },
        });
      });

      return toShow(newShow);
    } catch (error: unknown) {
      throw toAppError(error, 'Show', 'create');
    }
  }

  // A new startsAt moves endsAt too. Same FOR SHARE lock on the event as in create.
  async update(id: string, changes: UpdateShowInput): Promise<Show | null> {
    const { startsAt, ...rest } = changes;
    try {
      const updatedShow = await this.db.$transaction(async (tx) => {
        if (startsAt === undefined) {
          return tx.show.update({ where: { id }, data: rest });
        }

        const [event] = await tx.$queryRaw<DurationRow[]>`
          SELECT e.duration_mins AS "durationMins"
          FROM shows s
          JOIN events e ON e.id = s.event_id
          WHERE s.id = ${id}::uuid
          FOR SHARE OF e
        `;
        if (!event) {
          return null;
        }

        const startDate = new Date(startsAt);
        return tx.show.update({
          where: { id },
          data: { ...rest, startsAt: startDate, endsAt: toEndsAt(startDate, event.durationMins) },
        });
      });

      return updatedShow === null ? null : toShow(updatedShow);
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
