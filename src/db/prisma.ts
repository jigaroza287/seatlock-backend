import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('Database URL is missing in .env file');
}

const adapter = new PrismaPg({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const prisma = new PrismaClient({ adapter, log: env.LOG_QUERIES ? ['query'] : [] });
