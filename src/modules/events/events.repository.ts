import { randomUUID } from 'crypto';
import type { PaginationInput } from '../../shared/types.js';
import type {
  CreateEventInput,
  Event,
  EventListOutput,
  IEventRepository,
  UpdateEventInput,
} from './events.type.js';
import { AppError } from '../../shared/app-error.js';

class InMemoryEventRepository implements IEventRepository {
  #events = new Map<string, Event>();
  #isTitleTaken(title: string, excludeId?: string): boolean {
    for (const event of this.#events.values()) {
      if (event.id !== excludeId && event.title.toLowerCase() === title.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  findMany(paginationInput: PaginationInput): Promise<EventListOutput> {
    const allEvents = [...this.#events.values()];
    return Promise.resolve({
      items: allEvents.slice(
        paginationInput.offset,
        paginationInput.offset + paginationInput.limit
      ),
      total: allEvents.length,
    });
  }

  findById(id: string): Promise<Event | null> {
    return Promise.resolve(this.#events.get(id) ?? null);
  }

  create(input: CreateEventInput): Promise<Event> {
    if (this.#isTitleTaken(input.title)) {
      return Promise.reject(
        AppError.conflict('Event', `Title '${input.title}' is already used by another event`)
      );
    }

    const id = randomUUID();
    const event: Event = {
      id,
      ...input,
    };
    this.#events.set(id, event);
    return Promise.resolve(event);
  }

  update(id: string, changes: UpdateEventInput): Promise<Event | null> {
    const existingEvent = this.#events.get(id);
    if (existingEvent !== undefined) {
      if (changes.title) {
        if (this.#isTitleTaken(changes.title, id)) {
          return Promise.reject(
            AppError.conflict('Event', `Title '${changes.title}' is already used by another event`)
          );
        }
      }
      const updatedEvent = {
        ...existingEvent,
        ...changes,
      };
      this.#events.set(id, updatedEvent);
      return Promise.resolve(updatedEvent);
    }

    return Promise.resolve(null);
  }

  delete(id: string): Promise<boolean> {
    if (this.#events.has(id)) {
      this.#events.delete(id);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
}

export const eventRepository: IEventRepository = new InMemoryEventRepository();
