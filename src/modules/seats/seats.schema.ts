import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

// seat_categories.code, in sort order. Seeded by the 0_init migration.
export const SEAT_CATEGORIES = ['standard', 'premium', 'recliner'] as const;
export const seatCategorySchema = z.enum(SEAT_CATEGORIES);

export const createSeatSchema = z
  .object({
    // One letter, A to Z, same as the layout. Stored uppercase (seats_row_label_uppercase_check),
    // so "a" and "A" are the same row, and text sort matches row order.
    rowLabel: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]$/),
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

export const seatRowSchema = z
  .object({
    rowLabel: z
      .string()
      .trim()
      .toUpperCase()
      // A to Z: one letter per row, so a layout has at most 26 rows.
      .regex(/^[A-Z]$/),
    seatCount: z.number().int().min(1).max(100),
    category: seatCategorySchema,
  })
  .strict();

export const seatLayoutSchema = z
  .object({
    // One row per letter. 26 rows x 100 seats x 4 columns = 10,400 bind params, under the Postgres limit of 65,535.
    rows: z.array(seatRowSchema).min(1).max(26),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();

    data.rows.forEach((row, index) => {
      if (seen.has(row.rowLabel)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate row label: ${row.rowLabel}`,
          path: ['rows', index, 'rowLabel'],
        });
      }

      seen.add(row.rowLabel);
    });
  });
