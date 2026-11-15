import { AppError } from '../../shared/app-error.js';
import { venueRepository } from './venues.repository.js';
import type {
  CreateVenueInput,
  IVenueRepository,
  ListVenuesQuery,
  UpdateVenueInput,
  Venue,
  VenueListOutput,
} from './venues.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Venue', `Could not find any venue with id: ${id}`);
}

export class VenueService {
  constructor(private readonly repository: IVenueRepository) {}

  list(listVenuesQuery: ListVenuesQuery): Promise<VenueListOutput> {
    return this.repository.findMany(listVenuesQuery);
  }

  async getById(id: string): Promise<Venue> {
    const venue = await this.repository.findById(id);
    if (venue === null) {
      throw notFound(id);
    }

    return venue;
  }

  create(input: CreateVenueInput): Promise<Venue> {
    return this.repository.create(input);
  }

  async update(id: string, changes: UpdateVenueInput): Promise<Venue> {
    const updatedVenue = await this.repository.update(id, changes);
    if (updatedVenue === null) {
      throw notFound(id);
    }

    return updatedVenue;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const venueService = new VenueService(venueRepository);
