import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

// seat_categories.code, in sort order. Seeded by the 0_init migration.
export const SEAT_CATEGORIES = ['standard', 'premium', 'recliner'] as const;
export const seatCategorySchema = z.enum(SEAT_CATEGORIES);

export const createSeatSchema = z
  .object({
    // Stored uppercase, so "a" and "A" are the same row (unique index uses upper(row_label)).
    rowLabel: z.string().trim().toUpperCase().min(1).max(10),
    seatNumber: z.number().int().min(1).max(100),
    category: seatCategorySchema,
  })
  .strict();

export const updateSeatSchema = createSeatSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const listSeatQuerySchema = listQuerySchema.extend({
  category: seatCategorySchema.optional(),
});
