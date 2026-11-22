import { z } from 'zod';

export const envSchema = z.object({
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(5).max(30).default(10),
});

export type Env = z.infer<typeof envSchema>;

// Parsed once at import time. An invalid value throws here, so the app fails on startup.
export const env: Env = envSchema.parse(process.env);
