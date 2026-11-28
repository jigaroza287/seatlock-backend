import { AppError } from '../../shared/app-error.js';
import { eventRepository } from '../events/events.repository.js';
import type { IEventRepository } from '../events/events.type.js';
import { toSeatMap } from './shows.mapper.js';
import { showRepository } from './shows.repository.js';
import type {
  CreateShowInput,
  IShowRepository,
  ListShowsByEventQuery,
  ListShowsQuery,
  SeatMap,
  Show,
  ShowListingOutput,
  ShowListOutput,
  UpdateShowInput,
} from './shows.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Show', `Could not find any show with id: ${id}`);
}

function eventNotFound(eventId: string): AppError {
  return AppError.notFound('Event', `Could not find any event with id: ${eventId}`);
}

export class ShowService {
  constructor(
    private readonly repository: IShowRepository,
    private readonly eventRepository: IEventRepository
  ) {}

  list(listShowsQuery: ListShowsQuery): Promise<ShowListOutput> {
    return this.repository.findMany(listShowsQuery);
  }

  async getById(id: string): Promise<Show> {
    const show = await this.repository.findById(id);
    if (show === null) {
      throw notFound(id);
    }

    return show;
  }

  async getSeatMap(showId: string): Promise<SeatMap> {
    const showSeats = await this.repository.findSeatMap(showId);
    if (showSeats === null) {
      throw notFound(showId);
    }

    return toSeatMap(showId, showSeats);
  }

  // A list query has no insert to fail on, so the event is looked up first.
  async getShowsByEvent(listShowsQuery: ListShowsByEventQuery): Promise<ShowListingOutput> {
    const event = await this.eventRepository.findById(listShowsQuery.eventId);
    if (event === null) {
      throw eventNotFound(listShowsQuery.eventId);
    }

    return this.repository.findShowsByEvent(listShowsQuery);
  }

  // No event or screen check here: the repository maps their FK errors to 400.
  create(input: CreateShowInput): Promise<Show> {
    return this.repository.create(input);
  }

  async update(id: string, changes: UpdateShowInput): Promise<Show> {
    const updatedShow = await this.repository.update(id, changes);
    if (updatedShow === null) {
      throw notFound(id);
    }

    return updatedShow;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const showService = new ShowService(showRepository, eventRepository);
