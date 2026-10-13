import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/app-error.js';
import type { CommonErrorResponse } from '../shared/types.js';

function isJsonParseError(err: unknown): boolean {
  return err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response<CommonErrorResponse>,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : 'unknown';

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  if (isJsonParseError(err)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body', requestId },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        requestId,
        details: err.issues.map((issue) => ({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    });
  }
  console.error(`[${requestId}] Unhandled error`, err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      requestId,
    },
  });
}
