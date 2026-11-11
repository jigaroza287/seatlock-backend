import { defineConfig } from 'vitest/config';

// Unit and route tests only. Integration tests have their own config: vitest.int.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
