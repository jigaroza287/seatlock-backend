import { z } from 'zod';
import type {
  eventCategorySchema,
  createEventSchema,
  listEventQuerySchema,
  updateEventSchema,
} from './events.schema.js';

export type EventCategory = z.infer<typeof eventCategorySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventQuerySchema>;

export type Event = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  durationMins: number;
  language: string;
};

export type EventListOutput = { items: Event[]; total: number };

export interface IEventRepository {
  findMany(query: ListEventsQuery): Promise<EventListOutput>;
  findById(id: string): Promise<Event | null>;
  create(input: CreateEventInput): Promise<Event>;
  update(id: string, changes: UpdateEventInput): Promise<Event | null>;
  delete(id: string): Promise<boolean>;
}
