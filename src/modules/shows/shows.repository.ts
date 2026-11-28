import { prisma } from '../../db/prisma.js';
import { Prisma, type PrismaClient, type Show as ShowRow } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/app-error.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import type {
  CreateShowInput,
  IShowRepository,
  ListShowsByEventQuery,
  ListShowsQuery,
  Show,
  ShowListingOutput,
  ShowListingRow,
  ShowListOutput,
  ShowSeatView,
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

// Whether a show seat can be picked: free, or reserved with an expired hold. Used by the seat map
// and the event show listing so their counts can never disagree. Expects show_seats aliased as ss.
// Wrapped in parentheses so `... AND ${isSeatAvailable}` can't bind to the first OR branch only.
const isSeatAvailable = Prisma.sql`(
  ss.status = 'available' OR (ss.status = 'reserved' AND ss.held_until < now())
)`;

type SeatMapDbRow = {
  id: string;
  rowLabel: string;
  seatNumber: number;
  category: string;
  isAvailable: boolean;
};

function toShowSeatView({ isAvailable, ...seat }: SeatMapDbRow): ShowSeatView {
  return { ...seat, status: isAvailable ? 'available' : 'unavailable' };
}

// pg returns timestamptz columns as Date, so the raw row differs from ShowListingRow.
type ShowListingDbRow = Omit<ShowListingRow, 'startsAt' | 'endsAt'> & {
  startsAt: Date;
  endsAt: Date;
};

function toShowListingRow({ startsAt, endsAt, ...rest }: ShowListingDbRow): ShowListingRow {
  return { ...rest, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
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

  // A reserved seat whose hold has passed counts as available: expired holds are not cleaned up
  // yet, so the read applies the rule. The query returns a boolean, not a status string, because
  // the $queryRaw generic is an unchecked cast while pg reliably maps boolean to a JS boolean.
  // No rows means no show: creating a show on a screen with no seats is rejected, seats used by a
  // show can't be deleted, and a screen with shows can't be deleted.
  async findSeatMap(showId: string): Promise<ShowSeatView[] | null> {
    const rows = await this.db.$queryRaw<SeatMapDbRow[]>`
      SELECT
        ss.seat_id     AS "id",
        st.row_label   AS "rowLabel",
        st.seat_number AS "seatNumber",
        st.category,
        ${isSeatAvailable} AS "isAvailable"
      FROM show_seats ss
      JOIN seats st ON st.id = ss.seat_id
      WHERE ss.show_id = ${showId}::uuid
      ORDER BY st.row_label, st.seat_number
    `;

    if (rows.length === 0) {
      return null;
    }
    return rows.map(toShowSeatView);
  }

  async findShowsByEvent(listShowsQuery: ListShowsByEventQuery): Promise<ShowListingOutput> {
    const { eventId, limit, offset } = listShowsQuery;

    // Repeatable Read so both queries share one snapshot. Under the default Read Committed each
    // statement takes its own, so a show created in between could make total disagree with the page.
    const [rows, total] = await this.db.$transaction(
      [
        this.db.$queryRaw<ShowListingDbRow[]>`
      SELECT
        s.id,
        s.starts_at   AS "startsAt",
        s.ends_at     AS "endsAt",
        s.price_minor AS "priceMinor",
        sc.name       AS "screenName",
        v.name        AS "venueName",
        seat_counts.available
      FROM shows s
      JOIN screens sc ON sc.id = s.screen_id
      JOIN venues v   ON v.id = sc.venue_id
      CROSS JOIN LATERAL (
        SELECT (count(*) FILTER (WHERE ${isSeatAvailable}))::int AS available
        FROM show_seats ss
        WHERE ss.show_id = s.id
      ) seat_counts
      WHERE s.event_id = ${eventId}::uuid
      ORDER BY s.starts_at, s.id
      LIMIT ${limit} OFFSET ${offset}
    `,
        this.db.show.count({ where: { eventId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

    return { items: rows.map(toShowListingRow), total };
  }

  // endsAt = startsAt + event duration. The event row is read FOR SHARE so an event PATCH
  // that changes durationMins waits for this show to commit, then updates its endsAt too.
  // A missing screen fails on its FK, which toAppError maps to 400 with the field.
  // The same transaction creates one available show_seats row per seat on the screen.
  // A screen with no seats returns 409 and rolls back the show.
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
        const show = await tx.show.create({
          data: {
            eventId,
            screenId,
            startsAt: startDate,
            endsAt: toEndsAt(startDate, event.durationMins),
            priceMinor,
          },
        });

        const seats = await tx.seat.findMany({
          where: { screenId },
          select: { id: true },
        });

        if (seats.length === 0) {
          throw AppError.conflict('Show', 'Screen has no seats');
        }

        await tx.showSeat.createMany({
          data: seats.map((seat) => ({ showId: show.id, seatId: seat.id })),
        });

        return show;
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
