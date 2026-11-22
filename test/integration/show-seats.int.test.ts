import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db/prisma.js';
import { eventInput } from '../../src/modules/events/__tests__/events.fixtures.js';

// No API yet: these prove show_seats_state_check exists by writing raw rows straight to the database.

describe('show_seats integration', () => {
  let showId: string;
  let seatId: string;
  let bookingId: string;

  // Parent rows are setup, not under test, so they go straight through Prisma.
  beforeEach(async () => {
    const event = await prisma.event.create({ data: eventInput });
    const venue = await prisma.venue.create({ data: { name: 'Venue 1', city: 'Pune' } });
    const screen = await prisma.screen.create({ data: { name: 'Screen 1', venueId: venue.id } });
    const seat = await prisma.seat.create({
      data: { screenId: screen.id, rowLabel: 'A', seatNumber: 1, category: 'standard' },
    });
    const show = await prisma.show.create({
      data: {
        eventId: event.id,
        screenId: screen.id,
        startsAt: new Date('2026-12-01T14:30:00.000Z'),
        endsAt: new Date('2026-12-01T16:00:00.000Z'),
        priceMinor: 50_000,
      },
    });
    const booking = await prisma.booking.create({
      data: { showId: show.id, customerRef: 'customer-1', totalMinor: 50_000 },
    });

    showId = show.id;
    seatId = seat.id;
    bookingId = booking.id;
  });

  // Raw query failures surface as P2010; the message carries the constraint name.
  const stateCheckViolation = {
    code: 'P2010',
    message: expect.stringContaining('show_seats_state_check') as string,
  };

  // booking_id is set in both cases, so held_until is the only thing breaking the invariant.
  it('rejects a reserved seat without held_until', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO show_seats (show_id, seat_id, status, booking_id, held_until)
        VALUES (${showId}::uuid, ${seatId}::uuid, 'reserved', ${bookingId}::uuid, NULL)
      `
    ).rejects.toMatchObject(stateCheckViolation);
  });

  it('rejects a booked seat with held_until', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO show_seats (show_id, seat_id, status, booking_id, held_until)
        VALUES (${showId}::uuid, ${seatId}::uuid, 'booked', ${bookingId}::uuid, now() + interval '10 minutes')
      `
    ).rejects.toMatchObject(stateCheckViolation);
  });
});
