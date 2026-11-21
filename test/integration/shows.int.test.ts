import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { eventInput } from '../../src/modules/events/__tests__/events.fixtures.js';
import type { CreateShowInput, Show } from '../../src/modules/shows/shows.type.js';

// Real app, real database. Covers what the mocked route tests can't: constraints, queries, persistence.

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const missingId = '019a0000-0000-7000-8000-000000000999';

// Parent rows are setup, not under test, so they go straight through Prisma.
async function createEventId(title = eventInput.title): Promise<string> {
  const row = await prisma.event.create({ data: { ...eventInput, title } });
  return row.id;
}

async function createScreenId(name = 'Screen 1'): Promise<string> {
  const venue = await prisma.venue.create({ data: { name: `Venue for ${name}`, city: 'Pune' } });
  const row = await prisma.screen.create({ data: { name, venueId: venue.id } });
  return row.id;
}

function startTimesOf(body: unknown): string[] {
  return (body as { data: Show[] }).data.map((show) => show.startsAt);
}

describe('shows integration', () => {
  let eventId: string;
  let screenId: string;
  let input: CreateShowInput;

  async function createShow(overrides: Partial<CreateShowInput> = {}): Promise<Show> {
    const res = await request(app)
      .post('/api/shows')
      .send({ ...input, ...overrides });
    expect(res.status).toBe(201);
    return (res.body as { data: Show }).data;
  }

  beforeEach(async () => {
    eventId = await createEventId();
    screenId = await createScreenId();
    input = { eventId, screenId, startsAt: '2026-12-01T14:30:00.000Z', priceMinor: 50_000 };
  });

  describe('POST /api/shows', () => {
    it('saves the show with a database-generated id, readable via Location', async () => {
      const res = await request(app).post('/api/shows').send(input);

      expect(res.status).toBe(201);
      const created = (res.body as { data: Show }).data;
      // endsAt = startsAt + the event's 90 minutes.
      expect(created).toEqual({
        id: expect.stringMatching(uuidV7) as string,
        ...input,
        endsAt: '2026-12-01T16:00:00.000Z',
      });
      expect(res.headers['location']).toBe(`/api/shows/${created.id}`);

      const fetched = await request(app).get(`/api/shows/${created.id}`);
      expect(fetched.status).toBe(200);
      expect(fetched.body).toEqual({ data: created });
    });

    it('returns startsAt in UTC when sent with an offset', async () => {
      const created = await createShow({ startsAt: '2026-12-01T20:00:00+05:30' });

      expect(created.startsAt).toBe('2026-12-01T14:30:00.000Z');
    });

    it.each([
      { field: 'eventId', message: 'Event does not exist' },
      { field: 'screenId', message: 'Screen does not exist' },
    ] as const)(
      'returns 400 with the field when $field does not exist',
      async ({ field, message }) => {
        const res = await request(app)
          .post('/api/shows')
          .send({ ...input, [field]: missingId });

        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({
          error: { code: 'VALIDATION_ERROR', details: [{ field, message }] },
        });
      }
    );

    // shows_screen_id_starts_at_key compares instants, so a different offset is the same time.
    it('returns 409 when the screen has a show at the same instant in another offset', async () => {
      await createShow();

      const res = await request(app)
        .post('/api/shows')
        .send({ ...input, startsAt: '2026-12-01T20:00:00+05:30' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SHOW_CONFLICT', message: 'This screen already has a show at this time' },
      });
    });

    it('allows the same time on another screen', async () => {
      await createShow();
      const otherScreenId = await createScreenId('Screen 2');

      const res = await request(app)
        .post('/api/shows')
        .send({ ...input, screenId: otherScreenId });

      expect(res.status).toBe(201);
    });

    // The existing show runs 14:30 to 16:00 (90 min event). shows_no_overlap raises 23P01.
    it.each([
      { reason: 'starts during it', startsAt: '2026-12-01T15:00:00Z' },
      { reason: 'ends during it', startsAt: '2026-12-01T13:30:00Z' },
    ])('returns 409 when the new show $reason', async ({ startsAt }) => {
      await createShow();

      const res = await request(app)
        .post('/api/shows')
        .send({ ...input, startsAt });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SHOW_CONFLICT', message: 'Shows on this screen would overlap' },
      });
    });

    // [startsAt, endsAt) is half-open, so touching ends don't overlap.
    it.each([
      { reason: 'starts exactly when it ends', startsAt: '2026-12-01T16:00:00Z' },
      { reason: 'ends exactly when it starts', startsAt: '2026-12-01T13:00:00Z' },
    ])('allows a back-to-back show that $reason', async ({ startsAt }) => {
      await createShow();

      const res = await request(app)
        .post('/api/shows')
        .send({ ...input, startsAt });

      expect(res.status).toBe(201);
    });

    // Both requests run at once, so neither can see the other's row before inserting.
    // Only shows_no_overlap can stop the second one.
    it('lets exactly one of two parallel overlapping creates win', async () => {
      const [first, second] = await Promise.all([
        request(app).post('/api/shows').send(input),
        request(app)
          .post('/api/shows')
          .send({ ...input, startsAt: '2026-12-01T15:00:00Z' }),
      ]);

      expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);
      expect(await prisma.show.count({ where: { screenId } })).toBe(1);
    });
  });

  describe('GET /api/shows', () => {
    let otherEventId: string;
    let otherScreenId: string;

    // Two shows on one IST day, one the day before, and one at 18:00 on another screen and event.
    // Shows on one screen can't overlap: the 22:30 IST show ends (90 min) exactly at midnight.
    beforeEach(async () => {
      otherEventId = await createEventId('Rock concert');
      otherScreenId = await createScreenId('Screen 2');
      await createShow({ startsAt: '2026-11-20T12:30:00Z' }); // 18:00 IST, Nov 20
      await createShow({ startsAt: '2026-11-19T18:30:00Z' }); // 00:00 IST, Nov 20
      await createShow({ startsAt: '2026-11-19T17:00:00Z' }); // 22:30 IST, Nov 19
      await createShow({
        eventId: otherEventId,
        screenId: otherScreenId,
        startsAt: '2026-11-20T12:30:00Z',
      });
    });

    it('returns all shows ordered by startsAt with the total', async () => {
      const res = await request(app).get('/api/shows');

      expect(res.status).toBe(200);
      expect(startTimesOf(res.body)).toEqual([
        '2026-11-19T17:00:00.000Z',
        '2026-11-19T18:30:00.000Z',
        '2026-11-20T12:30:00.000Z',
        '2026-11-20T12:30:00.000Z',
      ]);
      expect(res.body).toMatchObject({ pagination: { limit: 20, offset: 0, total: 4 } });
    });

    it('breaks startsAt ties by id', async () => {
      const res = await request(app).get('/api/shows?offset=2');

      const ids = (res.body as { data: Show[] }).data.map((show) => show.id);
      expect(ids).toEqual([...ids].sort());
    });

    it('filters by eventId', async () => {
      const res = await request(app).get(`/api/shows?eventId=${otherEventId}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: [{ eventId: otherEventId }],
        pagination: { total: 1 },
      });
    });

    it('filters by screenId', async () => {
      const res = await request(app).get(`/api/shows?screenId=${otherScreenId}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: [{ screenId: otherScreenId }],
        pagination: { total: 1 },
      });
    });

    it('returns an empty list for an eventId with no shows', async () => {
      const res = await request(app).get(`/api/shows?eventId=${missingId}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], pagination: { limit: 20, offset: 0, total: 0 } });
    });

    // Half-open range: local midnight is included, the next local midnight is not.
    it('returns the shows of one day in the given offset', async () => {
      const res = await request(app).get(
        `/api/shows?screenId=${screenId}&from=2026-11-20T00:00:00%2B05:30&to=2026-11-21T00:00:00%2B05:30`
      );

      expect(res.status).toBe(200);
      expect(startTimesOf(res.body)).toEqual([
        '2026-11-19T18:30:00.000Z',
        '2026-11-20T12:30:00.000Z',
      ]);
      expect(res.body).toMatchObject({ pagination: { total: 2 } });
    });

    it('excludes a show that starts exactly at to', async () => {
      const res = await request(app).get(`/api/shows?screenId=${screenId}&to=2026-11-19T18:30:00Z`);

      expect(startTimesOf(res.body)).toEqual(['2026-11-19T17:00:00.000Z']);
    });

    it('pages with limit and offset while total counts every match', async () => {
      const res = await request(app).get('/api/shows?limit=1&offset=1');

      expect(res.status).toBe(200);
      expect(startTimesOf(res.body)).toEqual(['2026-11-19T18:30:00.000Z']);
      expect(res.body).toMatchObject({ pagination: { limit: 1, offset: 1, total: 4 } });
    });
  });

  describe('PATCH /api/shows/:id', () => {
    it('saves the change', async () => {
      const created = await createShow();

      const res = await request(app)
        .patch(`/api/shows/${created.id}`)
        .send({ startsAt: '2026-12-01T23:00:00+05:30', priceMinor: 0 });

      // endsAt moves with startsAt.
      const expected = {
        ...created,
        startsAt: '2026-12-01T17:30:00.000Z',
        endsAt: '2026-12-01T19:00:00.000Z',
        priceMinor: 0,
      };
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: expected });

      const fetched = await request(app).get(`/api/shows/${created.id}`);
      expect(fetched.body).toEqual({ data: expected });
    });

    it('returns 404 when the show does not exist', async () => {
      const res = await request(app).patch(`/api/shows/${missingId}`).send({ priceMinor: 0 });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });

    // A missing row matches no UPDATE, so the unique constraint is never checked.
    it('returns 404 before 409 when the show does not exist', async () => {
      await createShow();

      const res = await request(app)
        .patch(`/api/shows/${missingId}`)
        .send({ startsAt: input.startsAt });

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });

    it('returns 409 when moving into an overlapping time on the same screen', async () => {
      await createShow();
      const other = await createShow({ startsAt: '2026-12-01T18:00:00Z' });

      const res = await request(app)
        .patch(`/api/shows/${other.id}`)
        .send({ startsAt: '2026-12-01T15:00:00Z' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        error: { code: 'SHOW_CONFLICT', message: 'Shows on this screen would overlap' },
      });
    });

    // The new range overlaps the show's own old range; the constraint only compares other rows.
    it('allows moving a show by less than its duration', async () => {
      const created = await createShow();

      const res = await request(app)
        .patch(`/api/shows/${created.id}`)
        .send({ startsAt: '2026-12-01T15:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { startsAt: '2026-12-01T15:00:00.000Z', endsAt: '2026-12-01T16:30:00.000Z' },
      });
    });

    it('keeps startsAt and endsAt when only priceMinor changes', async () => {
      const created = await createShow();

      const res = await request(app).patch(`/api/shows/${created.id}`).send({ priceMinor: 0 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: { ...created, priceMinor: 0 } });
    });
  });

  describe('DELETE /api/shows/:id', () => {
    it('removes the show so it can no longer be fetched', async () => {
      const created = await createShow();

      const res = await request(app).delete(`/api/shows/${created.id}`);
      expect(res.status).toBe(204);

      const fetched = await request(app).get(`/api/shows/${created.id}`);
      expect(fetched.status).toBe(404);
    });

    it('returns 404 when the show does not exist', async () => {
      const res = await request(app).delete(`/api/shows/${missingId}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'SHOW_NOT_FOUND' } });
    });
  });
});
