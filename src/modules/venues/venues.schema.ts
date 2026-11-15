import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

const addressSchema = z.string().trim().min(1).max(500);

export const createVenueSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100),
    address: addressSchema.optional(),
  })
  .strict();

// PATCH can clear the address with null; POST can only omit it.
export const updateVenueSchema = createVenueSchema
  .extend({ address: addressSchema.nullable() })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const listVenueQuerySchema = listQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
});
