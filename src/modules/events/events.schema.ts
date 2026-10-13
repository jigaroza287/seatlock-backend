import { z } from 'zod';
import { CategorySchema } from './events.type.js';

export const createEventSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(20).max(2000),
  category: CategorySchema,
  durationMins: z.number().positive(),
  language: z.string().length(2),
});

export const updateEventSchema = createEventSchema.partial().strict();

export const listQuerySchema = z.object({
  limit: z.coerce.number().max(100).default(20),
  offset: z.coerce.number(),
});

export const idParamSchema = z.object({
  id: z.uuid(),
});
