import { describe, expect, it } from 'vitest';
import { envSchema } from '../env.js';

describe('envSchema', () => {
  it('defaults BOOKING_HOLD_MINUTES to 10 when unset', () => {
    expect(envSchema.parse({})).toEqual({ BOOKING_HOLD_MINUTES: 10 });
  });

  it('coerces BOOKING_HOLD_MINUTES from a string', () => {
    expect(envSchema.parse({ BOOKING_HOLD_MINUTES: '15' })).toEqual({ BOOKING_HOLD_MINUTES: 15 });
  });

  it.each(['0', '31', 'abc'])('rejects BOOKING_HOLD_MINUTES "%s"', (value) => {
    const result = envSchema.safeParse({ BOOKING_HOLD_MINUTES: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['BOOKING_HOLD_MINUTES']);
  });
});
