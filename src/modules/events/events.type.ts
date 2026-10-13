import { z } from 'zod';
import type { createEventSchema } from './events.schema.js';

export const CATEGORIES = ['concert', 'comedy', 'theatre', 'sports', 'movie'] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type CategoryType = z.infer<typeof CategorySchema>;

export type Event = z.infer<typeof createEventSchema> & { id: string };
export type UpdateEventPayload = Partial<Omit<Event, 'id'>>;
