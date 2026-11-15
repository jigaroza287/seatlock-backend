import { prisma } from '../../db/prisma.js';
import { type PrismaClient, type Venue as VenueRow } from '../../generated/prisma/client.js';
import { isRecordNotFound, toAppError } from '../../shared/prisma-error.js';
import type {
  CreateVenueInput,
  IVenueRepository,
  ListVenuesQuery,
  UpdateVenueInput,
  Venue,
  VenueListOutput,
} from './venues.type.js';

function toVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
  };
}

class VenueRepository implements IVenueRepository {
  constructor(private readonly db: PrismaClient) {}

  async findMany(query: ListVenuesQuery): Promise<VenueListOutput> {
    const where = {
      name: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
      city: query.city ? { equals: query.city, mode: 'insensitive' as const } : undefined,
    };

    const [rows, total] = await this.db.$transaction([
      this.db.venue.findMany({
        where,
        orderBy: [{ name: 'asc' }, { city: 'asc' }],
        skip: query.offset,
        take: query.limit,
      }),
      this.db.venue.count({ where }),
    ]);

    return { items: rows.map(toVenue), total };
  }

  async findById(id: string): Promise<Venue | null> {
    const row = await this.db.venue.findUnique({ where: { id } });
    if (!row) {
      return null;
    }
    return toVenue(row);
  }

  async create(input: CreateVenueInput): Promise<Venue> {
    const { name, city, address } = input;
    try {
      const newVenue = await this.db.venue.create({
        data: {
          name,
          city,
          address,
        },
      });
      return toVenue(newVenue);
    } catch (error: unknown) {
      throw toAppError(error, 'Venue', 'create');
    }
  }

  async update(id: string, changes: UpdateVenueInput): Promise<Venue | null> {
    try {
      const updatedVenue = await this.db.venue.update({ where: { id }, data: changes });
      return toVenue(updatedVenue);
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw toAppError(error, 'Venue', 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.db.venue.delete({ where: { id } });
      return true;
    } catch (error: unknown) {
      if (isRecordNotFound(error)) {
        return false;
      }
      throw toAppError(error, 'Venue', 'delete');
    }
  }
}

export const venueRepository: IVenueRepository = new VenueRepository(prisma);
