import { describe, expect, it } from 'vitest';
import { createEventSchema, listEventQuerySchema, updateEventSchema } from '../events.schema.js';
import type { CreateEventInput } from '../events.type.js';
import { eventInput } from './events.fixtures.js';

describe('createEventSchema', () => {
  it('accepts a valid event', () => {
    expect(createEventSchema.safeParse(eventInput).success).toBe(true);
  });

  it.each([
    { reason: 'only whitespace', title: '   ' },
    { reason: 'blank', title: '' },
    { reason: 'more than 100 characters long', title: 'a'.repeat(101) },
  ])('rejects a title that is $reason', ({ title }) => {
    const result = createEventSchema.safeParse({ ...eventInput, title });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['title']);
  });

  it.each([1, 100])('accepts a title of %i characters', (length) => {
    const result = createEventSchema.safeParse({
      ...eventInput,
      title: 'a'.repeat(length),
    });

    expect(result.success).toBe(true);
  });

  it.each([
    { reason: 'only whitespace', description: '   ' },
    { reason: 'blank', description: '' },
    { reason: 'fewer than 20 characters', description: 'a'.repeat(19) },
    { reason: 'more than 2000 characters', description: 'a'.repeat(2001) },
  ])('rejects a description that is $reason', ({ description }) => {
    const result = createEventSchema.safeParse({ ...eventInput, description });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['description']);
  });

  it.each([20, 2000])('accepts a description of %i characters', (length) => {
    const result = createEventSchema.safeParse({
      ...eventInput,
      description: 'a'.repeat(length),
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unsupported category', () => {
    const result = createEventSchema.safeParse({ ...eventInput, category: 'music' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['category']);
  });

  it('rejects a non-string category', () => {
    const result = createEventSchema.safeParse({ ...eventInput, category: 1 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['category']);
  });

  it.each([
    { reason: 'zero', durationMins: 0 },
    { reason: 'negative', durationMins: -1 },
    { reason: 'fractional', durationMins: 1.5 },
    { reason: 'not a number', durationMins: '90' },
  ])('rejects a duration that is $reason', ({ durationMins }) => {
    const result = createEventSchema.safeParse({ ...eventInput, durationMins });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['durationMins']);
  });

  it.each([
    { reason: 'one character', language: 'e' },
    { reason: 'three characters', language: 'eng' },
    { reason: 'uppercase', language: 'EN' },
    { reason: 'not two lowercase letters', language: 'e1' },
    { reason: 'not a string', language: 1 },
  ])('rejects a language that is $reason', ({ language }) => {
    const result = createEventSchema.safeParse({ ...eventInput, language });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['language']);
  });

  it('trims title, description, and language in the parsed event', () => {
    const result = createEventSchema.safeParse({
      ...eventInput,
      title: `  ${eventInput.title}  `,
      description: `  ${eventInput.description}  `,
      language: ` ${eventInput.language} `,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(eventInput);
    }
  });

  it.each(['title', 'description', 'category', 'durationMins', 'language'] as const)(
    'rejects a missing %s',
    (field) => {
      const body: Partial<CreateEventInput> = { ...eventInput };
      delete body[field];

      const result = createEventSchema.safeParse(body);

      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.path)).toContainEqual([field]);
    }
  );
});

describe('updateEventSchema', () => {
  it('accepts a valid partial update', () => {
    const result = updateEventSchema.safeParse({ title: 'Updated title' });

    expect(result.success).toBe(true);
  });

  it('trims fields in the parsed update', () => {
    const result = updateEventSchema.safeParse({
      title: '  Updated title  ',
      language: ' en ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ title: 'Updated title', language: 'en' });
    }
  });

  it('rejects an empty update', () => {
    expect(updateEventSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = updateEventSchema.safeParse({ unknown: 'value' });

    expect(result.success).toBe(false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        code: 'unrecognized_keys',
        keys: ['unknown'],
        path: [],
      });
    }
  });

  it.each([
    { field: 'title', value: '   ' },
    { field: 'description', value: 'too short' },
    { field: 'category', value: 'unknown' },
    { field: 'durationMins', value: 0 },
    { field: 'language', value: 'EN' },
  ])('rejects an invalid $field update', ({ field, value }) => {
    const result = updateEventSchema.safeParse({ [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe('listEventQuerySchema', () => {
  it('trims the search term', () => {
    const result = listEventQuerySchema.safeParse({ search: '  comedy  ' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.search).toBe('comedy');
    }
  });

  it.each(['', '   '])('rejects a blank search term', (search) => {
    const result = listEventQuerySchema.safeParse({ search });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['search']);
  });

  it('rejects a search term longer than 100 characters', () => {
    const result = listEventQuerySchema.safeParse({ search: 'a'.repeat(101) });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['search']);
  });

  it('rejects an unsupported category', () => {
    const result = listEventQuerySchema.safeParse({ category: 'unknown' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['category']);
  });
});
