import z from 'zod';

export const listQuerySchema = z.object({
  limit: z.coerce.number().positive().int().min(0).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const idParamSchema = z.object({
  id: z.uuid(),
});
