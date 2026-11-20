import { z } from 'zod';
import { listQuerySchema } from '../../shared/schema.js';

// ISO 8601 with a required offset (`Z` or `+05:30`). A timestamp without an offset is rejected.
const timestampSchema = z.iso.datetime({ offset: true });

export const createShowSchema = z
  .object({
    eventId: z.uuid(),
    screenId: z.uuid(),
    startsAt: timestampSchema,
    // Postgres `integer` max.
    priceMinor: z.number().int().min(0).max(2147483647),
  })
  .strict();

// eventId and screenId can't change: to move a show, delete it and create a new one.
// .strict() rejects them like any other unknown field.
export const updateShowSchema = createShowSchema
  .omit({ eventId: true, screenId: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

export const listShowQuerySchema = listQuerySchema
  .extend({
    eventId: z.uuid().optional(),
    screenId: z.uuid().optional(),
    from: timestampSchema.optional(),
    to: timestampSchema.optional(),
  })
  // Compare instants, not strings: `from` and `to` can use different offsets.
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      Date.parse(query.to) > Date.parse(query.from),
    { message: 'Must be after from', path: ['to'] }
  );
