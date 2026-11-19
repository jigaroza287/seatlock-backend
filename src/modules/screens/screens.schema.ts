import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

export const createScreenSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const updateScreenSchema = createScreenSchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

// No screen-specific filters in the contract, only limit and offset.
export const listScreenQuerySchema = listQuerySchema;
