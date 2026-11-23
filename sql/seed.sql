-- Seatlock demo data for local development and SQL practice.
-- Run with `pnpm db:seed` after `pnpm db:migrate`. Safe to re-run: it clears catalog and booking tables first.
-- Lookup tables (event_categories, seat_categories) are reference data, seeded by the 0_init migration.
--
-- Fixed UUID v7-format ids so queries can use them:
--   venues  ...0101+   screens ...0201+   events ...0301+   shows ...0401+
-- Seats use generated ids; show_seats picks them up by screen, not by id.
--
-- Deliberate edge cases for the practice queries:
--   - Lakeview Cinemas has a NULL address                  (IS NULL)
--   - Two venues in Ahmedabad                              (DISTINCT, GROUP BY city)
--   - Harbour Hall "Studio" has no seats                   (LEFT JOIN, WHERE vs ON)
--   - "Paper Boats" has no shows                           (LEFT JOIN, NOT EXISTS)
--   - Two shows start at the same time on different screens
--   - One free show (price_minor = 0)
BEGIN;

-- Every table with an FK into these must be listed too, or Postgres refuses the TRUNCATE.
TRUNCATE show_seats,
bookings,
shows,
seats,
screens,
events,
venues;

INSERT INTO
  venues (id, name, city, address)
VALUES
  (
    '01900000-0000-7000-8000-000000000101',
    'Riverfront Arena',
    'Ahmedabad',
    'Riverfront Road, Ahmedabad'
  ),
  (
    '01900000-0000-7000-8000-000000000102',
    'Lakeview Cinemas',
    'Ahmedabad',
    NULL
  ),
  (
    '01900000-0000-7000-8000-000000000103',
    'Harbour Hall',
    'Mumbai',
    'Seafront Lane, Mumbai'
  );

INSERT INTO
  screens (id, venue_id, name)
VALUES
  (
    '01900000-0000-7000-8000-000000000201',
    '01900000-0000-7000-8000-000000000101',
    'Main Hall'
  ),
  (
    '01900000-0000-7000-8000-000000000202',
    '01900000-0000-7000-8000-000000000102',
    'Audi 1'
  ),
  (
    '01900000-0000-7000-8000-000000000203',
    '01900000-0000-7000-8000-000000000102',
    'Audi 2'
  ),
  (
    '01900000-0000-7000-8000-000000000204',
    '01900000-0000-7000-8000-000000000103',
    'Studio'
  );

-- 62 seats: one row per (screen, row label), expanded into seat numbers 1..seats_in_row.
INSERT INTO
  seats (screen_id, row_label, seat_number, category)
SELECT
  r.screen_id::uuid,
  r.row_label,
  n,
  r.category
FROM
  (
    VALUES
      -- Main Hall: 3 rows x 10 = 30
      (
        '01900000-0000-7000-8000-000000000201',
        'A',
        10,
        'standard'
      ),
      (
        '01900000-0000-7000-8000-000000000201',
        'B',
        10,
        'standard'
      ),
      (
        '01900000-0000-7000-8000-000000000201',
        'C',
        10,
        'premium'
      ),
      -- Audi 1: 4 rows x 6 = 24
      (
        '01900000-0000-7000-8000-000000000202',
        'A',
        6,
        'standard'
      ),
      (
        '01900000-0000-7000-8000-000000000202',
        'B',
        6,
        'standard'
      ),
      (
        '01900000-0000-7000-8000-000000000202',
        'C',
        6,
        'premium'
      ),
      (
        '01900000-0000-7000-8000-000000000202',
        'D',
        6,
        'recliner'
      ),
      -- Audi 2: 2 rows x 4 = 8
      (
        '01900000-0000-7000-8000-000000000203',
        'A',
        4,
        'standard'
      ),
      (
        '01900000-0000-7000-8000-000000000203',
        'B',
        4,
        'recliner'
      )
      -- Studio (...0204): no seats on purpose
  ) AS r (screen_id, row_label, seats_in_row, category)
  CROSS JOIN LATERAL generate_series(1, r.seats_in_row) AS n;

INSERT INTO
  events (
    id,
    title,
    description,
    category,
    duration_mins,
    language
  )
VALUES
  (
    '01900000-0000-7000-8000-000000000301',
    'Indie Nights Live',
    'An evening of original music from independent bands across the city.',
    'concert',
    150,
    'hi'
  ),
  (
    '01900000-0000-7000-8000-000000000302',
    'Laugh Out Loud',
    'A stand-up comedy showcase featuring five rising comics.',
    'comedy',
    90,
    'en'
  ),
  (
    '01900000-0000-7000-8000-000000000303',
    'The Last Monsoon',
    'A family drama about three siblings returning home for one last rainy season.',
    'movie',
    135,
    'hi'
  ),
  (
    '01900000-0000-7000-8000-000000000304',
    'Paper Boats',
    'A two-act play about childhood friends who reunite after twenty years.',
    'theatre',
    110,
    'gu'
  );

-- Times are IST (+05:30); Postgres stores them as UTC.
-- ends_at = starts_at + the event's duration, the same rule the API applies on create.
INSERT INTO
  shows (
    id,
    event_id,
    screen_id,
    starts_at,
    ends_at,
    price_minor
  )
SELECT
  v.id::uuid,
  e.id,
  v.screen_id::uuid,
  v.starts_at::timestamptz,
  v.starts_at::timestamptz + e.duration_mins * interval '1 minute',
  v.price_minor
FROM
  (
    VALUES
      (
        '01900000-0000-7000-8000-000000000401',
        '01900000-0000-7000-8000-000000000301',
        '01900000-0000-7000-8000-000000000201',
        '2026-11-06 19:30+05:30',
        149900
      ),
      (
        '01900000-0000-7000-8000-000000000402',
        '01900000-0000-7000-8000-000000000301',
        '01900000-0000-7000-8000-000000000201',
        '2026-11-07 19:30+05:30',
        179900
      ),
      (
        '01900000-0000-7000-8000-000000000403',
        '01900000-0000-7000-8000-000000000302',
        '01900000-0000-7000-8000-000000000202',
        '2026-11-06 21:00+05:30',
        49900
      ),
      (
        '01900000-0000-7000-8000-000000000404',
        '01900000-0000-7000-8000-000000000302',
        '01900000-0000-7000-8000-000000000201',
        '2026-11-09 20:00+05:30',
        59900
      ),
      (
        '01900000-0000-7000-8000-000000000405',
        '01900000-0000-7000-8000-000000000303',
        '01900000-0000-7000-8000-000000000202',
        '2026-11-07 10:00+05:30',
        19900
      ),
      (
        '01900000-0000-7000-8000-000000000406',
        '01900000-0000-7000-8000-000000000303',
        '01900000-0000-7000-8000-000000000202',
        '2026-11-07 13:30+05:30',
        24900
      ),
      (
        '01900000-0000-7000-8000-000000000407',
        '01900000-0000-7000-8000-000000000303',
        '01900000-0000-7000-8000-000000000203',
        '2026-11-07 13:30+05:30',
        0
      ),
      (
        '01900000-0000-7000-8000-000000000408',
        '01900000-0000-7000-8000-000000000302',
        '01900000-0000-7000-8000-000000000203',
        '2026-11-08 18:00+05:30',
        39900
      )
  ) AS v (id, event_id, screen_id, starts_at, price_minor)
  JOIN events e ON e.id = v.event_id::uuid;

-- One available show seat per seat on the show's screen, same as show create in the API.
-- On a fresh database the backfill migration runs before this seed and finds no shows,
-- so the seed has to create these rows itself.
INSERT INTO
  show_seats (show_id, seat_id)
SELECT
  s.id,
  st.id
FROM
  shows s
  JOIN seats st ON st.screen_id = s.screen_id;

COMMIT;
