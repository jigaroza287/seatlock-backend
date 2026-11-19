import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../app-error.js';
import { toAppError } from '../prisma-error.js';

// Shape the pg adapter puts under meta.driverAdapterError.cause.
type AdapterCause = {
  originalCode?: string;
  constraint?: { index: string };
  message?: string;
};

function prismaError(code: string, cause?: AdapterCause) {
  return new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: 'test',
    meta: cause ? { driverAdapterError: { cause } } : undefined,
  });
}

describe('toAppError', () => {
  let warn: MockInstance<Console['warn']>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns errors that are not from Prisma unchanged', () => {
    const error = new Error('boom');

    expect(toAppError(error, 'Event', 'create')).toBe(error);
  });

  it('returns Prisma errors without a mapping unchanged', () => {
    const error = prismaError('P2025');

    expect(toAppError(error, 'Event', 'update')).toBe(error);
  });

  describe('P2002 unique violation', () => {
    it('returns 409 with the message for a known constraint', () => {
      const error = prismaError('P2002', {
        originalCode: '23505',
        constraint: { index: 'events_title_lower_key' },
      });

      const result = toAppError(error, 'Event', 'create');

      expect(result).toBeInstanceOf(AppError);
      expect(result).toMatchObject({
        statusCode: 409,
        code: 'EVENT_CONFLICT',
        message: 'An event with this title already exists',
      });
    });

    it('returns 409 with a fallback message for an unknown constraint', () => {
      const error = prismaError('P2002', {
        originalCode: '23505',
        constraint: { index: 'unknown_key' },
      });

      expect(toAppError(error, 'Event', 'create')).toMatchObject({
        statusCode: 409,
        code: 'EVENT_CONFLICT',
        message: 'Event already exists',
      });
    });
  });

  describe('P2003 foreign key', () => {
    it('returns 409 on delete when a known row still references it (23001)', () => {
      const error = prismaError('P2003', {
        originalCode: '23001',
        constraint: { index: 'shows_event_id_fkey' },
      });

      expect(toAppError(error, 'Event', 'delete')).toMatchObject({
        statusCode: 409,
        code: 'EVENT_CONFLICT',
        message: 'Event has scheduled shows',
      });
    });

    it('returns 409 with a fallback message on delete when the constraint is unknown', () => {
      expect(toAppError(prismaError('P2003'), 'Event', 'delete')).toMatchObject({
        statusCode: 409,
        code: 'EVENT_CONFLICT',
        message: 'Event is still referenced',
      });
    });

    it.each(['create', 'update'] as const)(
      'returns 404 for the parent on %s when the FK id comes from the path',
      (operation) => {
        const error = prismaError('P2003', {
          originalCode: '23503',
          constraint: { index: 'screens_venue_id_fkey' },
        });

        const result = toAppError(error, 'Screen', operation);

        expect(result).toBeInstanceOf(AppError);
        expect(result).toMatchObject({
          statusCode: 404,
          code: 'VENUE_NOT_FOUND',
          message: 'Venue does not exist',
        });
      }
    );

    it('still returns 409 on delete for a path parent FK (23001)', () => {
      const error = prismaError('P2003', {
        originalCode: '23001',
        constraint: { index: 'screens_venue_id_fkey' },
      });

      expect(toAppError(error, 'Venue', 'delete')).toMatchObject({
        statusCode: 409,
        code: 'VENUE_CONFLICT',
        message: 'Venue still has screens',
      });
    });

    it('returns 400 with field details on create for a known constraint (23503)', () => {
      const error = prismaError('P2003', {
        originalCode: '23503',
        constraint: { index: 'events_category_fkey' },
      });

      expect(toAppError(error, 'Event', 'create')).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: [{ field: 'category', message: 'Unknown event category' }],
      });
    });

    it('returns 400 without details on update for an unknown constraint', () => {
      const error = prismaError('P2003', {
        originalCode: '23503',
        constraint: { index: 'unknown_fkey' },
      });

      expect(toAppError(error, 'Event', 'update')).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: undefined,
      });
    });
  });

  describe('errors that Zod should have caught', () => {
    it.each([
      { code: 'P2011', sqlState: '23502' },
      { code: 'P2007', sqlState: '22P02' },
    ])('returns 400 and warns for $code ($sqlState)', ({ code, sqlState }) => {
      const result = toAppError(prismaError(code, { originalCode: sqlState }), 'Event', 'create');

      expect(result).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
      expect(warn).toHaveBeenCalledWith(`Zod gap on Event: SQLSTATE ${sqlState}, constraint none`);
    });

    it('returns 400 with field details for a known check constraint (23514)', () => {
      const error = prismaError('P2039', {
        originalCode: '23514',
        message:
          'new row for relation "events" violates check constraint "events_duration_mins_range_check"',
      });

      const result = toAppError(error, 'Event', 'create');

      expect(result).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: [{ field: 'durationMins', message: 'Must be 1 to 1440 minutes' }],
      });
      expect(warn).toHaveBeenCalledWith(
        'Zod gap on Event: SQLSTATE 23514, constraint events_duration_mins_range_check'
      );
    });

    it('returns 400 without details for an unknown check constraint', () => {
      const error = prismaError('P2039', {
        originalCode: '23514',
        message: 'new row for relation "events" violates check constraint "unknown_check"',
      });

      expect(toAppError(error, 'Event', 'create')).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: undefined,
      });
    });

    it('returns 400 without details when P2039 is not a check violation', () => {
      const error = prismaError('P2039', { originalCode: '40001' });

      expect(toAppError(error, 'Event', 'update')).toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: undefined,
      });
    });
  });
});
