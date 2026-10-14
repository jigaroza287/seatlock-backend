import { z } from 'zod';
import type { PaginationInput } from '../../shared/types.js';
import type { CategorySchema, createEventSchema, updateEventSchema } from './events.schema.js';

export type CategoryType = z.infer<typeof CategorySchema>;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type Event = CreateEventInput & { id: string };
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export type EventListOutput = { items: Event[]; total: number };

export interface EventRepository {
  findMany(paginationInput: PaginationInput): EventListOutput;
  findById(id: string): Event | undefined;
  findByTitle(title: string): Event | undefined;
  create(input: CreateEventInput): Event;
  update(id: string, changes: UpdateEventInput): Event | undefined;
  delete(id: string): boolean;
}
