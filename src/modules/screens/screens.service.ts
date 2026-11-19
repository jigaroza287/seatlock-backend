import { AppError } from '../../shared/app-error.js';
import { venueRepository } from '../venues/venues.repository.js';
import type { IVenueRepository } from '../venues/venues.type.js';
import { screenRepository } from './screens.repository.js';
import type {
  CreateScreenInput,
  IScreenRepository,
  ListScreensQuery,
  Screen,
  ScreenListOutput,
  UpdateScreenInput,
} from './screens.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Screen', `Could not find any screen with id: ${id}`);
}

function venueNotFound(venueId: string): AppError {
  return AppError.notFound('Venue', `Could not find any venue with id: ${venueId}`);
}

export class ScreenService {
  constructor(
    private readonly repository: IScreenRepository,
    private readonly venueRepository: IVenueRepository
  ) {}

  // A list query has no insert to fail on, so the venue is looked up first.
  async list(venueId: string, listScreensQuery: ListScreensQuery): Promise<ScreenListOutput> {
    const venue = await this.venueRepository.findById(venueId);
    if (venue === null) {
      throw venueNotFound(venueId);
    }

    return this.repository.findMany(venueId, listScreensQuery);
  }

  async getById(id: string): Promise<Screen> {
    const screen = await this.repository.findById(id);
    if (screen === null) {
      throw notFound(id);
    }

    return screen;
  }

  // No venue check here: the repository maps the FK error to VENUE_NOT_FOUND.
  create(venueId: string, input: CreateScreenInput): Promise<Screen> {
    return this.repository.create(venueId, input);
  }

  async update(id: string, changes: UpdateScreenInput): Promise<Screen> {
    const updatedScreen = await this.repository.update(id, changes);
    if (updatedScreen === null) {
      throw notFound(id);
    }

    return updatedScreen;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const screenService = new ScreenService(screenRepository, venueRepository);
