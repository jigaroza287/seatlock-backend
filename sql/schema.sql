CREATE TABLE venues (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  city       text NOT NULL,
  address    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, city)
);

CREATE TABLE screens (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  venue_id   uuid PRIMARY KEY DEFAULT uuidv7(),
  CONSTRAINT fk_screens_venues
    FOREIGN KEY (venue_id)
    REFERENCES venues(id)
    ON DELETE CASCADE
);

