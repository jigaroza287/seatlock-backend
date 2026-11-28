import type z from 'zod';
import type {
  eventIdParamSchema,
  idParamSchema,
  screenIdParamSchema,
  venueIdParamSchema,
} from './schema.js';

export type CommonError = {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
};

export type CommonErrorResponse = {
  error: CommonError;
};

export type IdParam = z.infer<typeof idParamSchema>;

export type VenueIdParam = z.infer<typeof venueIdParamSchema>;

export type ScreenIdParam = z.infer<typeof screenIdParamSchema>;

export type EventIdParam = z.infer<typeof eventIdParamSchema>;
