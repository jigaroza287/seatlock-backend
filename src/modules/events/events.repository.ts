import { randomUUID } from 'crypto';
import type { PaginationInput } from '../../shared/types.js';
import type {
  CreateEventInput,
  Event,
  EventListOutput,
  EventRepository,
  UpdateEventInput,
} from './events.type.js';

class InMemoryEventRepository implements EventRepository {
  #events = new Map<string, Event>();

  findMany(paginationInput: PaginationInput): EventListOutput {
    const allEvents = [...this.#events.values()];
    return {
      items: allEvents.slice(
        paginationInput.offset,
        paginationInput.offset + paginationInput.limit
      ),
      total: allEvents.length,
    };
  }

  findById(id: string): Event | undefined {
    return this.#events.get(id);
  }

  findByTitle(title: string): Event | undefined {
    for (const event of this.#events.values()) {
      if (event.title.toLocaleLowerCase() === title.toLocaleLowerCase()) {
        return event;
      }
    }

    return undefined;
  }

  create(input: CreateEventInput): Event {
    const id = randomUUID();
    const event: Event = {
      id,
      ...input,
    };
    this.#events.set(id, event);
    return event;
  }

  update(id: string, changes: UpdateEventInput): Event | undefined {
    const existingEvent = this.#events.get(id);
    if (existingEvent !== undefined) {
      const updatedEvent = {
        ...existingEvent,
        ...changes,
      };
      this.#events.set(id, updatedEvent);
      return updatedEvent;
    }

    return undefined;
  }

  delete(id: string): boolean {
    if (this.#events.has(id)) {
      this.#events.delete(id);
      return true;
    }

    return false;
  }
}

export const eventRepository: EventRepository = new InMemoryEventRepository();
