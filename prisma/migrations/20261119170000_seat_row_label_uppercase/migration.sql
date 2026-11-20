ALTER TABLE seats
ADD CONSTRAINT seats_row_label_uppercase_check CHECK (row_label = upper(row_label));
