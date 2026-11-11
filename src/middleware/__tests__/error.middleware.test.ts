import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommonErrorResponse } from '../../shared/types.js';
import { globalErrorHandler } from '../error.middleware.js';

// Calls the handler directly: these branches can't be reached reliably through the app.
// The fakes cover only what the handler touches, so they are cast to Express types.
function fakeResponse(headersSent: boolean) {
  const res = {
    headersSent,
    locals: { requestId: 'req-1' },
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

const req = {} as Request;

// NextFunction has overloads ('route' | 'router') a mock can't match; this signature fits all of them.
type Next = (err?: unknown) => void;

describe('globalErrorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the error to next when the response has already started', () => {
    const res = fakeResponse(true);
    const next = vi.fn<Next>();
    const error = new Error('Failed mid-stream');

    globalErrorHandler(error, req, res as unknown as Response<CommonErrorResponse>, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 500 with a generic message and logs unknown errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = fakeResponse(false);
    const next = vi.fn<Next>();
    const error = new Error('Connection refused');

    globalErrorHandler(error, req, res as unknown as Response<CommonErrorResponse>, next);

    expect(consoleError).toHaveBeenCalledWith('[req-1] Unhandled error', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId: 'req-1',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
