import { describe, expect, it } from 'vitest';
import { envSchema } from '../env.js';

describe('envSchema', () => {
  it('applies the defaults when nothing is set', () => {
    expect(envSchema.parse({})).toEqual({ BOOKING_HOLD_MINUTES: 10, LOG_QUERIES: false });
  });

  it('coerces BOOKING_HOLD_MINUTES from a string', () => {
    expect(envSchema.parse({ BOOKING_HOLD_MINUTES: '15' })).toMatchObject({
      BOOKING_HOLD_MINUTES: 15,
    });
  });

  it.each(['0', '31', 'abc'])('rejects BOOKING_HOLD_MINUTES "%s"', (value) => {
    const result = envSchema.safeParse({ BOOKING_HOLD_MINUTES: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['BOOKING_HOLD_MINUTES']);
  });

  it.each([
    { value: 'true', expected: true },
    { value: 'false', expected: false },
  ])('parses LOG_QUERIES "$value" as $expected', ({ value, expected }) => {
    expect(envSchema.parse({ LOG_QUERIES: value })).toMatchObject({ LOG_QUERIES: expected });
  });

  it('rejects a LOG_QUERIES value that is not a boolean word', () => {
    const result = envSchema.safeParse({ LOG_QUERIES: 'maybe' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['LOG_QUERIES']);
  });
});
