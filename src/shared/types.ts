import type z from 'zod';
import type { idParamSchema } from '../modules/events/events.schema.js';

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
