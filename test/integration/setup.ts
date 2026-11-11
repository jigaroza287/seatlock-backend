import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/db/prisma.js';

// Every test starts from empty data tables. Lookup tables (event_categories, seat_categories)
// are seeded by the migration and kept.
beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE venues, screens, seats, events, shows CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});
