DROP TABLE IF EXISTS shows,
seats,
seat_categories,
screens,
venues,
events,
event_categories CASCADE;

CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  city text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_name_length_check CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT venues_name_city_key UNIQUE (name, city)
);

CREATE TABLE screens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL,
  venue_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT screens_venue_id_fkey FOREIGN key (venue_id) REFERENCES venues (id) ON DELETE RESTRICT,
  CONSTRAINT screens_venue_id_name_key UNIQUE (venue_id, name)
);

CREATE TABLE seat_categories (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL,
  CONSTRAINT seat_categories_sort_order_non_negative_check CHECK (sort_order >= 0),
  CONSTRAINT seat_categories_sort_order_key UNIQUE (sort_order)
);

INSERT INTO
  seat_categories (code, label, sort_order)
VALUES
  ('standard', 'Standard', 0),
  ('premium', 'Premium', 1),
  ('recliner', 'Recliner', 2);

CREATE TABLE seats (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  screen_id uuid NOT NULL,
  row_label text NOT NULL,
  seat_number integer NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seats_screen_id_fkey FOREIGN key (screen_id) REFERENCES screens (id) ON DELETE CASCADE,
  CONSTRAINT seats_row_label_not_empty_check CHECK (char_length(row_label) > 0),
  CONSTRAINT seats_seat_number_positive_check CHECK (seat_number > 0),
  CONSTRAINT seats_category_fkey FOREIGN key (category) REFERENCES seat_categories (code) ON DELETE RESTRICT,
  CONSTRAINT seats_screen_id_row_label_seat_number_key UNIQUE (screen_id, row_label, seat_number)
);

CREATE TABLE event_categories (code text PRIMARY KEY, label text NOT NULL);

INSERT INTO
  event_categories (code, label)
VALUES
  ('concert', 'Concert'),
  ('comedy', 'Comedy'),
  ('theatre', 'Theatre'),
  ('sports', 'Sports'),
  ('movie', 'Movie');

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  duration_mins integer NOT NULL,
  language text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_title_key UNIQUE (title),
  CONSTRAINT events_title_length_check CHECK (char_length(title) BETWEEN 1 AND 100),
  CONSTRAINT events_description_length_check CHECK (char_length(description) BETWEEN 20 AND 2000),
  CONSTRAINT events_category_fkey FOREIGN key (category) REFERENCES event_categories (code) ON DELETE RESTRICT,
  CONSTRAINT events_duration_mins_positive_check CHECK (duration_mins > 0),
  CONSTRAINT events_language_length_check CHECK (char_length(language) = 2)
);

CREATE TABLE shows (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_id uuid NOT NULL,
  screen_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  price_minor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shows_event_id_fkey FOREIGN key (event_id) REFERENCES events (id) ON DELETE RESTRICT,
  CONSTRAINT shows_screen_id_fkey FOREIGN key (screen_id) REFERENCES screens (id) ON DELETE RESTRICT,
  CONSTRAINT shows_screen_id_starts_at_key UNIQUE (screen_id, starts_at),
  CONSTRAINT shows_price_minor_non_negative_check CHECK (price_minor >= 0)
);
