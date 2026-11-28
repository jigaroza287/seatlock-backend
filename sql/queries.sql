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
-- Query 6: Every show with its event title, start time and price
SELECT
  e.title,
  s.starts_at,
  s.price_minor
FROM
  shows s
  JOIN events e ON s.event_id = e.id;

-- Result of Query 6: 8 rows, all the records from shows table with name of the event
-- Query 7: The same, but every event, including ones with no shows
SELECT
  e.title,
  s.starts_at,
  s.price_minor
FROM
  events e
  LEFT JOIN shows s ON s.event_id = e.id;

-- Result of Query 7: 9 rows, all the events with shows + Paper Boats with no show
-- Query 8: For every screen, how many recliner seats it has
SELECT
  sc.name,
  count(se.id)
FROM
  screens sc
  LEFT JOIN seats se ON se.screen_id = sc.id
  AND se.category = 'recliner'
GROUP BY
  sc.id,
  sc.name;

-- Result of Query 8: 2 rows, Audi 2 has 4 and Audi 1 has 6 recliner seats if use where condition se.category = 'recliner'. 4 rows, Audi 2 has 4, Audi 1 has 6 and remaining 2 have 0 recliner seats if use the condition se.category = 'recliner' in ON. The reason is LEFT JOIN...ON takes all the rows from screens and applies the condition at the same time, whereas in where, condition applies after getting 4 records, so it gives only 2 at the end.
-- Query 9: For every event: number of shows and average price. Then keep only events with 3 or more shows
SELECT
  e.title,
  count(s.id) AS total_shows,
  round(avg(s.price_minor)) AS avg_price_minor
FROM
  events e
  LEFT JOIN shows s ON s.event_id = e.id
GROUP BY
  e.title
HAVING
  count(s.id) >= 3;

-- Result of Query 9: 2 rows, as only two events The Last Monsoon and Laugh Out Loud have 3 or more shows. The reason of using having instead of where is having filters the result after grouping and where does it before.
-- Query 10: Top 5 shows by potential revenue (seats on that screen × ticket price)
SELECT
  sw.id AS show_id,
  count(se.id) * sw.price_minor AS potential_revenue
FROM
  shows sw
  JOIN seats se ON se.screen_id = sw.screen_id
GROUP BY
  sw.id,
  sw.price_minor
ORDER BY
  potential_revenue DESC
LIMIT
  5;

-- Result of Query 10: 5 rows ids ending 402, 401, 404, 403, 406. Top is 5397000 paise.
-- Query 11: Shows priced above the average show price
SELECT
  *
FROM
  shows
WHERE
  price_minor > (
    SELECT
      avg(price_minor)
    FROM
      shows
  );

-- Result of Query 11: 2 rows ids ending 401, 402. Avg returns scalar value, so it works perfectly with subquery in where condition.
-- Query 12: Events that have no shows
SELECT
  *
FROM
  events e
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      shows s
    WHERE
      s.event_id = e.id
  );

-- Result of Query 12: 1 row Paper boats.
-- Query 13: Seat count per screen per category, with categories in display order (sort_order)
SELECT
  s.name,
  se.category,
  count(se.id) AS seat_count
FROM
  seats se
  JOIN screens s ON s.id = se.screen_id
  JOIN seat_categories sc ON sc.code = se.category
GROUP BY
  s.id,
  s.name,
  se.category,
  sc.sort_order
ORDER BY
  s.name,
  sc.sort_order;

-- Result of Query 13: 7 rows order by sort_order in seat_categories.
-- Query 14: For every venue: number of screens and total seat capacity
SELECT
  v.city,
  v.name,
  count(DISTINCT sc.id) AS total_screens,
  count(se.id) AS total_seats
FROM
  venues v
  LEFT JOIN screens sc ON sc.venue_id = v.id
  LEFT JOIN seats se ON se.screen_id = sc.id
GROUP BY
  v.id,
  v.city,
  v.name;

-- Result of Query 14: 3 rows, distinct count is the key.
-- Query 15: API query: shows for The Last Monsoon in Ahmedabad on 7 Nov (IST), with venue, screen, start time and price, earliest first
SELECT
  e.title,
  v.city,
  v.name,
  s.name,
  sw.starts_at,
  sw.price_minor
FROM
  shows sw
  JOIN events e ON e.id = sw.event_id
  JOIN screens s ON s.id = sw.screen_id
  JOIN venues v ON v.id = s.venue_id
WHERE
  v.city = 'Ahmedabad'
  AND sw.starts_at >= (
    '2026-11-07'::date::timestamp AT time zone 'Asia/Kolkata'
  )
  AND sw.starts_at < (
    '2026-11-07'::date::timestamp AT time zone 'Asia/Kolkata'
  ) + interval '1 day'
  AND sw.event_id = '01900000-0000-7000-8000-000000000303'
ORDER BY
  sw.starts_at,
  s.name;

-- Result of Query 15: 3 rows
SELECT
  s.id AS "showId",
  s.starts_at AS "startsAt",
  s.ends_at AS "endsAt",
  s.price_minor AS "priceMinor",
  sc.name AS "screenName",
  v.name AS "venueName"
FROM
  shows s
  INNER JOIN show_seats ss ON ss.show_id = s.id
  INNER JOIN screens sc ON s.screen_id = sc.id
  INNER JOIN venues v ON sc.venue_id = v.id
