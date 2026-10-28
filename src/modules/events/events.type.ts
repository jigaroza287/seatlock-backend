import { z } from 'zod';
import type { PaginationInput } from '../../shared/types.js';
import type { CategorySchema, createEventSchema, updateEventSchema } from './events.schema.js';

export type CategoryType = z.infer<typeof CategorySchema>;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type Event = CreateEventInput & { id: string };
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export type EventListOutput = { items: Event[]; total: number };

export interface EventRepository {
  findMany(paginationInput: PaginationInput): Promise<EventListOutput>;
  findById(id: string): Promise<Event | null>;
  create(input: CreateEventInput): Promise<Event>;
  update(id: string, changes: UpdateEventInput): Promise<Event | null>;
  delete(id: string): Promise<boolean>;
}
