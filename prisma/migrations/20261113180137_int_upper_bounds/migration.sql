ALTER TABLE events
DROP CONSTRAINT events_duration_mins_positive_check;

ALTER TABLE events
ADD CONSTRAINT events_duration_mins_range_check CHECK (duration_mins BETWEEN 1 AND 1440);

ALTER TABLE seats
DROP CONSTRAINT seats_seat_number_positive_check;

ALTER TABLE seats
ADD CONSTRAINT seats_seat_number_range_check CHECK (seat_number BETWEEN 1 AND 100);
