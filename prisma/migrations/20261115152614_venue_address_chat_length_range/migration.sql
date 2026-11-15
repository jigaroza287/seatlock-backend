ALTER TABLE venues
ADD CONSTRAINT venues_address_length_check CHECK (char_length(trim(address)) BETWEEN 1 AND 500);
