import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Seat as SeatRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import { seatCategorySchema } from './seats.schema.js';
import type {
  CreateSeatInput,
  ISeatRepository,
  ListSeatsQuery,
  Seat,
  SeatListOutput,
  UpdateSeatInput,
} from './seats.type.js';

function toSeat(row: SeatRow): Seat {
  return {
    id: row.id,
    screenId: row.screenId,
    rowLabel: row.rowLabel,
    seatNumber: row.seatNumber,
    category: seatCategorySchema.parse(row.category),
  };
}

class SeatRepository implements ISeatRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(screenId: string, query: ListSeatsQuery): Promise<SeatListOutput> {
    const where = { screenId, category: query.category };

    const [rows, total] = await this.db.$transaction([
      this.db.seat.findMany({
        where,
        orderBy: [{ rowLabel: 'asc' }, { seatNumber: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.seat.count({ where }),
    ]);

    return { items: rows.map(toSeat), total };
  }

  async findById(id: string): Promise<Seat | null> {
    const row = await this.db.seat.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toSeat(row);
  }

  // A missing screen fails on seats_screen_id_fkey, which toAppError maps to SCREEN_NOT_FOUND.
  async create(screenId: string, input: CreateSeatInput): Promise<Seat> {
    const { rowLabel, seatNumber, category } = input;
    try {
      const newSeat = await this.db.seat.create({
        data: {
          screenId,
          rowLabel,
          seatNumber,
          category,
        },
      });
      return toSeat(newSeat);
    } catch (error: unknown) {
      throw toAppError(error, 'Seat', 'create');
    }
  }

  async update(id: string, changes: UpdateSeatInput): Promise<Seat | null> {
    try {
      const updatedSeat = await this.db.seat.update({ where: { id }, data: changes });
      return toSeat(updatedSeat);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw toAppError(error, 'Seat', 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.seat.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Seat', 'delete');
    }
  }
}

export const seatRepository: ISeatRepository = new SeatRepository(prisma);
