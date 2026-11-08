import { Prisma } from '../generated/prisma/client.js';
import { AppError } from './app-error.js';

// Maps database errors to API errors. Rules and tables follow docs/pg-errors.md.

type Operation = 'create' | 'update' | 'delete';

type FieldError = { field: string; message: string };

// 23505 unique_violation -> 409
const UNIQUE_MESSAGES: Record<string, string> = {
  venues_name_city_key: 'A venue with this name already exists in this city',
  screens_venue_id_name_key: 'A screen with this name already exists at this venue',
  seats_screen_id_row_label_seat_number_key: 'This seat already exists on this screen',
  events_title_lower_key: 'An event with this title already exists',
  shows_screen_id_starts_at_key: 'This screen already has a show at this time',
};

// 23503 foreign_key_violation on create or update -> 400
const FOREIGN_KEY_FIELDS: Record<string, FieldError> = {
  screens_venue_id_fkey: { field: 'venueId', message: 'Venue does not exist' },
  seats_screen_id_fkey: { field: 'screenId', message: 'Screen does not exist' },
  seats_category_fkey: { field: 'category', message: 'Unknown seat category' },
  events_category_fkey: { field: 'category', message: 'Unknown event category' },
  shows_event_id_fkey: { field: 'eventId', message: 'Event does not exist' },
  shows_screen_id_fkey: { field: 'screenId', message: 'Screen does not exist' },
};

// 23001 restrict_violation on delete -> 409
const RESTRICT_MESSAGES: Record<string, string> = {
  screens_venue_id_fkey: 'Venue still has screens',
  shows_screen_id_fkey: 'Screen has scheduled shows',
  shows_event_id_fkey: 'Event has scheduled shows',
};

// 23514 check_violation -> 400
const CHECK_FIELDS: Record<string, FieldError> = {
  venues_name_length_check: { field: 'name', message: 'Must be 1 to 100 characters' },
  venues_city_length_check: { field: 'city', message: 'Must be 1 to 100 characters' },
  screens_name_length_check: { field: 'name', message: 'Must be 1 to 100 characters' },
  seats_row_label_not_empty_check: { field: 'rowLabel', message: 'Must not be empty' },
  seats_seat_number_positive_check: { field: 'seatNumber', message: 'Must be greater than 0' },
  events_title_length_check: { field: 'title', message: 'Must be 1 to 100 characters' },
  events_description_length_check: {
    field: 'description',
    message: 'Must be 20 to 2000 characters',
  },
  events_duration_mins_positive_check: { field: 'durationMins', message: 'Must be greater than 0' },
  events_language_length_check: { field: 'language', message: 'Must be exactly 2 characters' },
  shows_price_minor_non_negative_check: { field: 'priceMinor', message: 'Must not be negative' },
};

type DbErrorInfo = {
  sqlState?: string;
  constraint?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The pg adapter keeps the original Postgres error under meta.driverAdapterError.cause.
function readDbError(err: Prisma.PrismaClientKnownRequestError): DbErrorInfo {
  const adapterError = err.meta?.['driverAdapterError'];
  if (!isRecord(adapterError) || !isRecord(adapterError['cause'])) {
    return {};
  }
  const cause = adapterError['cause'];
  const sqlState = typeof cause['originalCode'] === 'string' ? cause['originalCode'] : undefined;

  // 23505, 23503, 23001: the adapter exposes the constraint name as { index }.
  const constraintInfo = cause['constraint'];
  if (isRecord(constraintInfo) && typeof constraintInfo['index'] === 'string') {
    return { sqlState, constraint: constraintInfo['index'] };
  }

  // 23514: no constraint field, so read it from the Postgres message.
  const message = typeof cause['message'] === 'string' ? cause['message'] : '';
  const constraint = /constraint "([^"]+)"/.exec(message)?.[1];
  return { sqlState, constraint };
}

function validationError(details?: FieldError[]): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details);
}

// 23514, 23502 and 22P02 mean Zod let bad input through.
function warnZodGap(entity: string, info: DbErrorInfo): void {
  console.warn(
    `Zod gap on ${entity}: SQLSTATE ${info.sqlState ?? 'unknown'}, constraint ${info.constraint ?? 'none'}`
  );
}

/**
 * Converts a Prisma error into an AppError.
 * Returns the original error when there is no mapping, so the error middleware sends a 500.
 * Usage: `catch (err) { throw toAppError(err, 'Event', 'create'); }`
 */
export function toAppError(err: unknown, entity: string, operation: Operation): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
    return err;
  }
  const info = readDbError(err);
  const constraint = info.constraint ?? '';

  switch (err.code) {
    // 23505 unique_violation
    case 'P2002': {
      const message = UNIQUE_MESSAGES[constraint];
      return message ? AppError.conflict(entity, message) : err;
    }

    // Prisma uses P2003 for both 23503 and 23001, so the operation decides.
    case 'P2003': {
      if (operation === 'delete') {
        const message = RESTRICT_MESSAGES[constraint];
        return message ? AppError.conflict(entity, message) : err;
      }
      const fieldError = FOREIGN_KEY_FIELDS[constraint];
      return fieldError ? validationError([fieldError]) : err;
    }

    // 23502 not_null_violation, 22P02 invalid_text_representation
    case 'P2011':
    case 'P2007': {
      warnZodGap(entity, info);
      return validationError();
    }

    // Postgres errors without a Prisma code, e.g. 23514 check_violation
    case 'P2039': {
      if (info.sqlState !== '23514') {
        return err;
      }
      const fieldError = CHECK_FIELDS[constraint];
      if (!fieldError) {
        return err;
      }
      warnZodGap(entity, info);
      return validationError([fieldError]);
    }

    default:
      return err;
  }
}
