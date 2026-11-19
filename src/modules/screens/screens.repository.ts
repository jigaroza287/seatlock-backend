import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Screen as ScreenRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import type {
  CreateScreenInput,
  IScreenRepository,
  ListScreensQuery,
  Screen,
  ScreenListOutput,
  UpdateScreenInput,
} from './screens.type.js';

function toScreen(row: ScreenRow): Screen {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
  };
}

class ScreenRepository implements IScreenRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(venueId: string, query: ListScreensQuery): Promise<ScreenListOutput> {
    const where = { venueId };

    const [rows, total] = await this.db.$transaction([
      this.db.screen.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.screen.count({ where }),
    ]);

    return { items: rows.map(toScreen), total };
  }

  async findById(id: string): Promise<Screen | null> {
    const row = await this.db.screen.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toScreen(row);
  }

  // A missing venue fails on screens_venue_id_fkey, which toAppError maps to VENUE_NOT_FOUND.
  async create(venueId: string, input: CreateScreenInput): Promise<Screen> {
    const { name } = input;
    try {
      const newScreen = await this.db.screen.create({
        data: {
          venueId,
          name,
        },
      });
      return toScreen(newScreen);
    } catch (error: unknown) {
      throw toAppError(error, 'Screen', 'create');
    }
  }

  async update(id: string, changes: UpdateScreenInput): Promise<Screen | null> {
    try {
      const updatedScreen = await this.db.screen.update({ where: { id }, data: changes });
      return toScreen(updatedScreen);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw toAppError(error, 'Screen', 'update');
    }
  }

  // Seats cascade; shows block the delete (23001), which maps to SCREEN_CONFLICT.
  async delete(id: string): Promise<boolean> {
    try {
      await this.db.screen.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Screen', 'delete');
    }
  }
}

export const screenRepository: IScreenRepository = new ScreenRepository(prisma);
