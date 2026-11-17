import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Load test database settings before workers start; they inherit process.env
if (existsSync('.env.test')) process.loadEnvFile('.env.test');

// Standalone on purpose: mergeConfig concatenates arrays, so the unit include/exclude would leak in
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.int.test.ts'],

    // globalSetup runs once per run; setupFiles runs before each test file
    globalSetup: ['test/integration/global-setup.ts'],
    setupFiles: ['test/integration/setup.ts'],

    // One file at a time so files don't truncate each other's rows (also forces a single worker)
    fileParallelism: false,

    // Database work is slower than unit tests
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
