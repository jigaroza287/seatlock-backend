import { z } from 'zod';
import type { createEventSchema } from './events.schema.js';

export const CATEGORIES = ['concert', 'comedy', 'theatre', 'sports', 'movie'] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type CategoryType = z.infer<typeof CategorySchema>;

type CreateEventInput = z.infer<typeof createEventSchema>;
type UpdateEventInput = Partial<Omit<Event, 'id'>>;

export type Event = CreateEventInput & { id: string };

export interface EventRepository {
  findAll(): Event[];
  findById(id: string): Event | undefined;
  findByTitle(title: string): Event | undefined;
  create(input: CreateEventInput): Event;
  update(id: string, changes: UpdateEventInput): Event | undefined;
  delete(id: string): boolean;
}
