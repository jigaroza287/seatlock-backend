import { describe, expect, it } from 'vitest';
import { idParamSchema, listQuerySchema } from '../schema.js';

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
    expect(
      idParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' }).success
    ).toBe(true);
  });

  it.each(['not-a-uuid', ''])('rejects an invalid id: "%s"', (id) => {
    expect(idParamSchema.safeParse({ id }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});