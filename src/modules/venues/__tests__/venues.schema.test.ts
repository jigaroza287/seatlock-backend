import { describe, expect, it } from 'vitest';
import { createVenueSchema, listVenueQuerySchema, updateVenueSchema } from '../venues.schema.js';
import type { CreateVenueInput } from '../venues.type.js';
import { venueInput } from './venues.fixtures.js';

describe('createVenueSchema', () => {
  it('accepts a valid venue', () => {
    expect(createVenueSchema.safeParse(venueInput).success).toBe(true);
  });

  it('accepts a venue without an address', () => {
    const { name, city } = venueInput;

    expect(createVenueSchema.safeParse({ name, city }).success).toBe(true);
  });

  it.each(['name', 'city'] as const)('rejects a %s that is blank or too long', (field) => {
    for (const value of ['', '   ', 'a'.repeat(101)]) {
      const result = createVenueSchema.safeParse({ ...venueInput, [field]: value });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([field]);
    }
  });

  it.each(['name', 'city'] as const)('accepts a %s of 1 and 100 characters', (field) => {
    for (const length of [1, 100]) {
      const result = createVenueSchema.safeParse({ ...venueInput, [field]: 'a'.repeat(length) });

      expect(result.success).toBe(true);
    }
  });

  it.each([
    { reason: 'blank', address: '' },
    { reason: 'only whitespace', address: '   ' },
    { reason: 'more than 500 characters long', address: 'a'.repeat(501) },
    { reason: 'null', address: null },
  ])('rejects an address that is $reason', ({ address }) => {
    const result = createVenueSchema.safeParse({ ...venueInput, address });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['address']);
  });

  it('accepts an address of 500 characters', () => {
    const result = createVenueSchema.safeParse({ ...venueInput, address: 'a'.repeat(500) });

    expect(result.success).toBe(true);
  });

  it('trims name, city and address in the parsed venue', () => {
    const result = createVenueSchema.safeParse({
      name: `  ${venueInput.name}  `,
      city: ` ${venueInput.city} `,
      address: `  ${venueInput.address ?? ''}  `,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(venueInput);
    }
  });

  it.each(['name', 'city'] as const)('rejects a missing %s', (field) => {
    const body: Partial<CreateVenueInput> = { ...venueInput };
    delete body[field];

    const result = createVenueSchema.safeParse(body);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([field]);
  });

  it('rejects an id in the body', () => {
    const result = createVenueSchema.safeParse({ ...venueInput, id: 'abc' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['id'] });
  });
});

describe('updateVenueSchema', () => {
  it('accepts a valid partial update', () => {
    expect(updateVenueSchema.safeParse({ city: 'Mumbai' }).success).toBe(true);
  });

  it('accepts a null address to clear it', () => {
    const result = updateVenueSchema.safeParse({ address: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ address: null });
    }
  });

  it('trims fields in the parsed update', () => {
    const result = updateVenueSchema.safeParse({ name: '  New hall  ', address: ' 1 Main Road ' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'New hall', address: '1 Main Road' });
    }
  });

  it('rejects an empty update', () => {
    expect(updateVenueSchema.safeParse({}).success).toBe(false);
  });

  it.each(['id', 'unknown'])('rejects the field %s', (field) => {
    const result = updateVenueSchema.safeParse({ [field]: 'value' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: [field] });
  });

  it.each([
    { field: 'name', value: '   ' },
    { field: 'name', value: null },
    { field: 'city', value: 'a'.repeat(101) },
    { field: 'city', value: null },
    { field: 'address', value: '   ' },
    { field: 'address', value: 'a'.repeat(501) },
  ])('rejects an invalid $field update ($value)', ({ field, value }) => {
    const result = updateVenueSchema.safeParse({ [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('listVenueQuerySchema', () => {
  it('trims search and city', () => {
    const result = listVenueQuerySchema.safeParse({ search: '  hall  ', city: ' Pune ' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ search: 'hall', city: 'Pune' });
    }
  });

  it.each(['search', 'city'] as const)('rejects a %s that is blank or too long', (field) => {
    for (const value of ['', '   ', 'a'.repeat(101)]) {
      const result = listVenueQuerySchema.safeParse({ [field]: value });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual([field]);
    }
  });
});
