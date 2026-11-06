import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

export const CATEGORIES = ['concert', 'comedy', 'theatre', 'sports', 'movie'] as const;
export const CategorySchema = z.enum(CATEGORIES);

export const createEventSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(20).max(2000),
  category: CategorySchema,
  durationMins: z.number().int().positive(),
  language: z.string().length(2),
});

export const updateEventSchema = createEventSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const listEventQuerySchema = listQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  category: CategorySchema.optional(),
});
