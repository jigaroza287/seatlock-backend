import { AppError } from '../../shared/app-error.js';
import type { PaginationInput } from '../../shared/types.js';
import { eventRepository } from './events.repository.js';
import type {
  CreateEventInput,
  Event,
  EventListOutput,
  IEventRepository,
  UpdateEventInput,
} from './events.type.js';

function notFound(id: string): AppError {
  return AppError.notFound('Event', `Could not find any event with id: ${id}`);
}

class EventService {
  constructor(private readonly repository: IEventRepository) {}

  list(paginationInput: PaginationInput): Promise<EventListOutput> {
    return this.repository.findMany(paginationInput);
  }

  async getById(id: string): Promise<Event> {
    const event = await this.repository.findById(id);
    if (event === null) {
      throw notFound(id);
    }

    return event;
  }

  create(input: CreateEventInput): Promise<Event> {
    return this.repository.create(input);
  }

  async update(id: string, changes: UpdateEventInput): Promise<Event> {
    const updatedEvent = await this.repository.update(id, changes);
    if (updatedEvent === null) {
      throw notFound(id);
    }

    return updatedEvent;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw notFound(id);
    }
  }
}

export const eventService = new EventService(eventRepository);
