ALTER TABLE screens
DROP CONSTRAINT screens_venue_id_name_key;

CREATE UNIQUE INDEX screens_venue_id_name_lower_key ON screens (venue_id, lower(name));
