import { AppError } from '../../shared/app-error.js';
import { screenRepository } from '../screens/screens.repository.js';
import type { IScreenRepository } from '../screens/screens.type.js';
import { seatRepository } from './seats.repository.js';
import type {
  CreateSeatInput,
  ISeatRepository,
  ListSeatsQuery,
  Seat,
  SeatListOutput,
  UpdateSeatInput,
} from './seats.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Seat', `Could not find any seat with id: ${id}`);
}

function screenNotFound(screenId: string): AppError {
  return AppError.notFound('Screen', `Could not find any screen with id: ${screenId}`);
}

export class SeatService {
  constructor(
    private readonly repository: ISeatRepository,
    private readonly screenRepository: IScreenRepository
  ) {}

  // A list query has no insert to fail on, so the screen is looked up first.
  async list(screenId: string, listSeatsQuery: ListSeatsQuery): Promise<SeatListOutput> {
    const screen = await this.screenRepository.findById(screenId);
    if (screen === null) {
      throw screenNotFound(screenId);
    }

    return this.repository.findMany(screenId, listSeatsQuery);
  }

  async getById(id: string): Promise<Seat> {
    const seat = await this.repository.findById(id);
    if (seat === null) {
      throw notFound(id);
    }

    return seat;
  }

  // No screen check here: the repository maps the FK error to SCREEN_NOT_FOUND.
  create(screenId: string, input: CreateSeatInput): Promise<Seat> {
    return this.repository.create(screenId, input);
  }

  async update(id: string, changes: UpdateSeatInput): Promise<Seat> {
    const updatedSeat = await this.repository.update(id, changes);
    if (updatedSeat === null) {
      throw notFound(id);
    }

    return updatedSeat;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const seatService = new SeatService(seatRepository, screenRepository);
