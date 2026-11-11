import { execFileSync } from 'node:child_process';

// Runs once in the main process, before any test file. DATABASE_URL comes from .env.test.
export default function setup() {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is missing in .env.test');
  }

  // Integration tests truncate tables, so never let them reach the dev database.
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to run against "${databaseName}": database name must end with _test`);
  }

  // Applies pending migrations only; never resets or prompts.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--config', 'prisma7.config.ts'], {
    stdio: 'inherit',
  });
}
