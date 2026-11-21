-- 1. Install required PostgreSQL extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add ends_at as nullable initially
ALTER TABLE shows
ADD COLUMN ends_at timestamptz;

-- 3. Backfill existing shows
UPDATE shows s
SET
  ends_at = s.starts_at + make_interval(mins => e.duration_mins)
FROM
  events e
WHERE
  e.id = s.event_id;

-- 4. Enforce NOT NULL
ALTER TABLE shows
ALTER COLUMN ends_at
SET NOT NULL;

-- 5. Prevent overlapping shows on the same screen
ALTER TABLE shows
ADD CONSTRAINT shows_no_overlap EXCLUDE USING gist (
  screen_id
  WITH
    =,
    tstzrange (starts_at, ends_at)
  WITH
    &&
);
