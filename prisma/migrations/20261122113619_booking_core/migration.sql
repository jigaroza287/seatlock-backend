-- CreateTable
CREATE TABLE "bookings" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "show_id" uuid NOT NULL,
  "customer_ref" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "total_minor" integer NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "show_seats" (
  "show_id" uuid NOT NULL,
  "seat_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'available',
  "booking_id" uuid,
  "held_until" timestamptz(6),
  "version" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "show_seats_pkey" PRIMARY KEY ("show_id", "seat_id")
);

-- AddForeignKey
ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "show_seats"
ADD CONSTRAINT "show_seats_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "show_seats"
ADD CONSTRAINT "show_seats_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "show_seats"
ADD CONSTRAINT "show_seats_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddStatusCheck
ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check CHECK (
  status IN ('pending', 'confirmed', 'cancelled', 'expired')
);

-- AddTotalMinorNonNegativeCheck
ALTER TABLE bookings
ADD CONSTRAINT bookings_total_minor_non_negative_check CHECK (total_minor >= 0);

-- AddStatusCheck
ALTER TABLE show_seats
ADD CONSTRAINT show_seats_status_check CHECK (status IN ('available', 'reserved', 'booked'));

-- AddVersionNonNegativeCheck
ALTER TABLE show_seats
ADD CONSTRAINT show_seats_version_non_negative_check CHECK (version >= 0);

-- AddStatusBookingIdHeldUntilCheck
ALTER TABLE show_seats
ADD CONSTRAINT show_seats_state_check CHECK (
  (
    status = 'available'
    AND booking_id IS NULL
    AND held_until IS NULL
  )
  OR (
    status = 'reserved'
    AND booking_id IS NOT NULL
    AND held_until IS NOT NULL
  )
  OR (
    status = 'booked'
    AND booking_id IS NOT NULL
    AND held_until IS NULL
  )
);
