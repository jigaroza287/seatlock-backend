-- Query 1: Comedy or movie events, in Hindi or English, longer than 100 minutes
SELECT
  *
FROM
  events
WHERE
  category IN ('comedy', 'movie')
  AND language IN ('hi', 'en')
  AND duration_mins > 100;

-- Result of Query 1: 1 row, The Last Monsoon
-- Query 2: All shows ordered by start time, then by price highest first
SELECT
  *
FROM
  shows
ORDER BY
  starts_at,
  price_minor DESC;

-- Result of Query 2: 8 rows, starting from 2026-11-06 14:00:00+00 as starts_at value to 2026-11-09 14:30:00+00, only two same values for starts_at 2026-11-07 08:00:00+00, from those one with price_minor 24900 displays first
-- Query 3: Page 2 of seats in Audi 1 (...0202), 10 per page, ordered by row then seat number
SELECT
  *
FROM
  seats
WHERE
  screen_id = '01900000-0000-7000-8000-000000000202'
ORDER BY
  row_label,
  seat_number
LIMIT
  10
OFFSET
  10;

-- Result of Query 3: 10 rows, offset 10 as we need 2nd page, order by row_label and seat number in ASC order
-- Query 4: Each screen and the seat categories it offers, without duplicates
SELECT DISTINCT
  v.name,
  sc.name,
  se.category
FROM
  venues v
  JOIN screens sc ON sc.venue_id = v.id
  JOIN seats se ON se.screen_id = sc.id
WHERE
  sc.id = se.screen_id
ORDER BY
  v.name,
  sc.name,
  se.category;

-- Result of Query 4: 7 rows, 3 for Audi 1 with premium, recliner and standard, 2 for Audi 2, recliner and standard and 2 for Main Hall, premium and standard
-- Query 5: Venues with no address on record
SELECT
  *
FROM
  venues
WHERE
  address IS NULL;

-- Result of Query 5: 1 row, Lakeview Cinemas
