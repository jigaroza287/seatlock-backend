import { describe, expect, it } from 'vitest';
import { createShowSchema, listShowQuerySchema, updateShowSchema } from '../shows.schema.js';
import type { CreateShowInput } from '../shows.type.js';
import { showInput } from './shows.fixtures.js';

describe('createShowSchema', () => {
  it('accepts a valid show', () => {
    expect(createShowSchema.safeParse(showInput).success).toBe(true);
  });

  it.each(['eventId', 'screenId'] as const)('rejects a %s that is not a UUID', (field) => {
    const result = createShowSchema.safeParse({ ...showInput, [field]: 'not-a-uuid' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it.each([
    { reason: 'UTC with Z', startsAt: '2026-12-01T14:30:00Z' },
    { reason: 'a positive offset', startsAt: '2026-12-01T20:00:00+05:30' },
    { reason: 'a negative offset', startsAt: '2026-12-01T09:30:00-05:00' },
    { reason: 'milliseconds', startsAt: '2026-12-01T14:30:00.123Z' },
  ])('accepts a startsAt with $reason', ({ startsAt }) => {
    const result = createShowSchema.safeParse({ ...showInput, startsAt });

    expect(result.success).toBe(true);
  });

  it.each([
    { reason: 'has no offset', startsAt: '2026-12-01T14:30:00' },
    { reason: 'is only a date', startsAt: '2026-12-01' },
    { reason: 'is not a date', startsAt: 'tomorrow' },
    { reason: 'is a number', startsAt: 1_764_599_400_000 },
  ])('rejects a startsAt that $reason', ({ startsAt }) => {
    const result = createShowSchema.safeParse({ ...showInput, startsAt });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['startsAt']);
  });

  it.each([0, 2147483647])('accepts a priceMinor of %i', (priceMinor) => {
    const result = createShowSchema.safeParse({ ...showInput, priceMinor });

    expect(result.success).toBe(true);
  });

  it.each([
    { reason: 'negative', priceMinor: -1 },
    { reason: 'above the integer max', priceMinor: 2147483648 },
    { reason: 'fractional', priceMinor: 499.5 },
    { reason: 'a string', priceMinor: '500' },
  ])('rejects a priceMinor that is $reason', ({ priceMinor }) => {
    const result = createShowSchema.safeParse({ ...showInput, priceMinor });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['priceMinor']);
  });

  it.each(['eventId', 'screenId', 'startsAt', 'priceMinor'] as const)(
    'rejects a missing %s',
    (field) => {
      const body: Partial<CreateShowInput> = { ...showInput };
      delete body[field];

      const result = createShowSchema.safeParse(body);

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([field]);
    }
  );

  it('rejects an id in the body', () => {
    const result = createShowSchema.safeParse({
      ...showInput,
      id: '019a0000-0000-7000-8000-000000000001',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['id'] });
  });
});

describe('updateShowSchema', () => {
  it('accepts a valid partial update', () => {
    expect(updateShowSchema.safeParse({ priceMinor: 0 }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updateShowSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = updateShowSchema.safeParse({ endsAt: '2026-12-01T17:00:00Z' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['endsAt'] });
  });

  it.each(['eventId', 'screenId'] as const)('rejects %s as an unrecognized key', (field) => {
    const result = updateShowSchema.safeParse({ [field]: showInput[field] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: [field] });
  });

  it.each([
    { field: 'startsAt', value: '2026-12-01T14:30:00' },
    { field: 'priceMinor', value: -1 },
  ])('rejects an invalid $field update', ({ field, value }) => {
    const result = updateShowSchema.safeParse({ [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('listShowQuerySchema', () => {
  it('accepts every filter together', () => {
    const result = listShowQuerySchema.safeParse({
      eventId: showInput.eventId,
      screenId: showInput.screenId,
      from: '2026-11-20T00:00:00+05:30',
      to: '2026-11-21T00:00:00+05:30',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    { reason: 'only from', query: { from: '2026-11-20T00:00:00+05:30' } },
    { reason: 'only to', query: { to: '2026-11-21T00:00:00+05:30' } },
  ])('accepts $reason', ({ query }) => {
    expect(listShowQuerySchema.safeParse(query).success).toBe(true);
  });

  // Same instant in two offsets: to is not after from.
  it.each([
    { reason: 'equal to from', to: '2026-11-20T00:00:00+05:30' },
    { reason: 'the same instant in another offset', to: '2026-11-19T18:30:00Z' },
    { reason: 'before from', to: '2026-11-19T00:00:00+05:30' },
  ])('rejects a to that is $reason', ({ to }) => {
    const result = listShowQuerySchema.safeParse({ from: '2026-11-20T00:00:00+05:30', to });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['to']);
  });

  it.each(['eventId', 'screenId'] as const)('rejects a %s that is not a UUID', (field) => {
    const result = listShowQuerySchema.safeParse({ [field]: 'abc' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it.each(['from', 'to'] as const)('rejects a %s without an offset', (field) => {
    const result = listShowQuerySchema.safeParse({ [field]: '2026-11-20T00:00:00' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});
