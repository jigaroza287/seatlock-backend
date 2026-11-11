import { defineConfig } from 'vitest/config';

// Unit and route tests only. Integration tests have their own config: vitest.int.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/generated/**',
        'src/**/__tests__/**',
        'src/server.ts',
        'src/**/*.type.ts',
        'src/shared/types.ts',
      ],
    },
  },
});
