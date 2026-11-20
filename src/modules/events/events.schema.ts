import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

export const EVENT_CATEGORIES = ['concert', 'comedy', 'theatre', 'sports', 'movie'] as const;
export const eventCategorySchema = z.enum(EVENT_CATEGORIES);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(20).max(2000),
    category: eventCategorySchema,
    durationMins: z.number().int().positive().max(1440),
    language: z
      .string()
      .trim()
      .regex(/^[a-z]{2}$/),
  })
  .strict();

export const updateEventSchema = createEventSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const listEventQuerySchema = listQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  category: eventCategorySchema.optional(),
});
