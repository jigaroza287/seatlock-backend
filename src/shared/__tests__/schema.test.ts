import { describe, expect, it } from 'vitest';
import {
  eventIdParamSchema,
  idParamSchema,
  listQuerySchema,
  screenIdParamSchema,
  venueIdParamSchema,
} from '../schema.js';

describe('listQuerySchema', () => {
  it('uses default pagination values', () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
  });

  it('coerces pagination strings to numbers', () => {
    expect(listQuerySchema.parse({ limit: '50', offset: '10' })).toEqual({
      limit: 50,
      offset: 10,
    });
  });

  it.each([1, 100])('accepts a limit of %i', (limit) => {
    expect(listQuerySchema.safeParse({ limit }).success).toBe(true);
  });

  it.each([
    { field: 'limit', value: '0' },
    { field: 'limit', value: '-1' },
    { field: 'limit', value: '1.5' },
    { field: 'limit', value: '101' },
    { field: 'limit', value: 'invalid' },
    { field: 'offset', value: '-1' },
    { field: 'offset', value: '1.5' },
    { field: 'offset', value: 'invalid' },
  ])('rejects invalid $field value "$value"', ({ field, value }) => {
    const result = listQuerySchema.safeParse({ [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('idParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(idParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(
      true
    );
  });

  it.each(['not-a-uuid', ''])('rejects an invalid id: "%s"', (id) => {
    expect(idParamSchema.safeParse({ id }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('venueIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      venueIdParamSchema.safeParse({ venueId: '550e8400-e29b-41d4-a716-446655440000' }).success
    ).toBe(true);
  });

  it.each(['not-a-uuid', ''])('rejects an invalid venueId: "%s"', (venueId) => {
    expect(venueIdParamSchema.safeParse({ venueId }).success).toBe(false);
  });

  it('rejects a missing venueId', () => {
    expect(venueIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('screenIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      screenIdParamSchema.safeParse({ screenId: '550e8400-e29b-41d4-a716-446655440000' }).success
    ).toBe(true);
  });

  it.each(['not-a-uuid', ''])('rejects an invalid screenId: "%s"', (screenId) => {
    expect(screenIdParamSchema.safeParse({ screenId }).success).toBe(false);
  });

  it('rejects a missing screenId', () => {
    expect(screenIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('eventIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    expect(
      eventIdParamSchema.safeParse({ eventId: '550e8400-e29b-41d4-a716-446655440000' }).success
    ).toBe(true);
  });

  it.each(['not-a-uuid', ''])('rejects an invalid eventId: "%s"', (eventId) => {
    expect(eventIdParamSchema.safeParse({ eventId }).success).toBe(false);
  });

  it('rejects a missing eventId', () => {
    expect(eventIdParamSchema.safeParse({}).success).toBe(false);
  });
});
