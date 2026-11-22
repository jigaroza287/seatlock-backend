# Postgres error codes to HTTP

How the repository layer turns Postgres errors into API errors. Every response uses the [error shape](./api-contract.md#error-shape).

## Seeing the code in psql

```sql
\set VERBOSITY verbose   -- show SQLSTATE and constraint name on every error
\errverbose              -- or: full detail of the last error only
```

In `pg`, the error object carries `code`, `constraint`, `table` and `detail`.

## Summary

| SQLSTATE | Name                        | When                                         | HTTP    | API code                |
| -------- | --------------------------- | -------------------------------------------- | ------- | ----------------------- |
| `23505`  | unique_violation            | Row already exists                           | **409** | `<ENTITY>_CONFLICT`     |
| `23503`  | foreign_key_violation       | Insert or update points to a missing parent  | **400** | `VALIDATION_ERROR`      |
| `23503`  | foreign_key_violation       | Same, parent id comes from the URL path      | **404** | `<PARENT>_NOT_FOUND`    |
| `23001`  | restrict_violation          | Delete blocked by `ON DELETE RESTRICT`       | **409** | `<ENTITY>_CONFLICT`     |
| `23P01`  | exclusion_violation         | Row overlaps another, e.g. two shows         | **409** | `<ENTITY>_CONFLICT`     |
| `23514`  | check_violation             | Value breaks a CHECK (Zod gap)               | **400** | `VALIDATION_ERROR`      |
| `23502`  | not_null_violation          | Required column missing (Zod gap)            | **400** | `VALIDATION_ERROR`      |
| `22P02`  | invalid_text_representation | Bad input for a type, e.g. `'abc'` as a uuid | **400** | `VALIDATION_ERROR`      |
| other    | anything else               | Unexpected                                   | **500** | `INTERNAL_SERVER_ERROR` |

## Rules

- **Map by constraint name, not only by code.** The name decides the entity and the field in the message.
- **23503 only means "missing parent" here.** Every FK has an explicit `ON DELETE` rule, so a blocked delete returns `23001`, never `23503`. A new FK left at the default `NO ACTION` would break this: a blocked delete would return `23503` and map to 400 instead of 409.
- **Parent id in the URL path is a 404, not a 400.** For nested routes such as `POST /venues/:id/screens`, a missing venue is `VENUE_NOT_FOUND`. A missing id in the request body is a 400.
- **23514 and 23502 mean Zod missed something.** Return 400, log a warning, then fix the schema. Common cause: Zod `.min(1)` accepts `"   "` while the CHECK trims first. Use `.trim()` in Zod.
- **Never send `detail` to the client.** It holds row values, e.g. `Key (name, city)=(PVR, Pune)`. Log it with the request id.
- **Constraints the API can't reach map to 500.** Primary keys (ids come from `uuidv7()`), lookup-table constraints and lookup deletes. If one fires, it's a bug.

## By constraint

### 23505 unique_violation → 409

| Constraint                                  | Trigger                                  | API code          | Message                                              |
| ------------------------------------------- | ---------------------------------------- | ----------------- | ---------------------------------------------------- |
| `venues_name_city_key`                      | Same venue name in the same city         | `VENUE_CONFLICT`  | A venue with this name already exists in this city   |
| `screens_venue_id_name_lower_key`           | Same screen name at the same venue       | `SCREEN_CONFLICT` | A screen with this name already exists at this venue |
| `seats_screen_id_row_label_seat_number_key` | Same row and number on the same screen   | `SEAT_CONFLICT`   | This seat already exists on this screen              |
| `events_title_lower_key`                    | Duplicate event title                    | `EVENT_CONFLICT`  | An event with this title already exists              |
| `shows_screen_id_starts_at_key`             | Two shows on one screen at the same time | `SHOW_CONFLICT`   | This screen already has a show at this time          |
| `seat_categories_sort_order_key`            | Reference data only                      | n/a               | 500                                                  |

**Exception: seat layout.** `POST /api/screens/:screenId/seats/layout` inserts many seats in one statement, so a hit on `seats_screen_id_row_label_seat_number_key` can't say which seat clashed. The repository catches it with `isUniqueViolation()` before `toAppError` and returns `SEAT_CONFLICT` with the message `Some seats in this layout already exist on this screen`. The whole insert is rolled back.

### 23503 foreign_key_violation (insert or update) → 400

| Constraint             | Field      | Message                |
| ---------------------- | ---------- | ---------------------- |
| `seats_category_fkey`  | `category` | Unknown seat category  |
| `events_category_fkey` | `category` | Unknown event category |
| `shows_event_id_fkey`  | `eventId`  | Event does not exist   |
| `shows_screen_id_fkey` | `screenId` | Screen does not exist  |

Put the field in `details`, e.g. `[{ field: "eventId", message: "Event does not exist" }]`, so it matches the Zod error shape.

### 23503 foreign_key_violation (insert or update, parent id from the path) → 404

| Constraint              | Path param | API code           | Message               |
| ----------------------- | ---------- | ------------------ | --------------------- |
| `screens_venue_id_fkey` | `venueId`  | `VENUE_NOT_FOUND`  | Venue does not exist  |
| `seats_screen_id_fkey`  | `screenId` | `SCREEN_NOT_FOUND` | Screen does not exist |

These FKs only ever receive an id from the path, so the constraint name is enough to return 404. If one ever gets ids from both the path and a body, revisit this mapping.

### 23001 restrict_violation (delete) → 409

| Constraint                                    | Trigger                                 | API code          | Message                    |
| --------------------------------------------- | --------------------------------------- | ----------------- | -------------------------- |
| `screens_venue_id_fkey`                       | Delete a venue that has screens         | `VENUE_CONFLICT`  | Venue still has screens    |
| `shows_screen_id_fkey`                        | Delete a screen that has shows          | `SCREEN_CONFLICT` | Screen has scheduled shows |
| `shows_event_id_fkey`                         | Delete an event that has shows          | `EVENT_CONFLICT`  | Event has scheduled shows  |
| `show_seats_seat_id_fkey`                     | Delete a seat used by a show            | `SEAT_CONFLICT`   | Seat is used by a show     |
| `bookings_show_id_fkey`                       | Delete a show that has bookings         | `SHOW_CONFLICT`   | Show has bookings          |
| `show_seats_booking_id_fkey`                  | Delete a booking (never done; bug only) | n/a               | 500                        |
| `seats_category_fkey`, `events_category_fkey` | Delete a lookup row                     | n/a               | 500                        |

`seats_screen_id_fkey` is `ON DELETE CASCADE`: deleting a screen removes its seats with no error. If the screen has shows, `shows_screen_id_fkey` blocks the whole delete first.

`show_seats_show_id_fkey` is `ON DELETE CASCADE`: deleting a show with no bookings removes its `show_seats` rows. If the show has bookings, `bookings_show_id_fkey` blocks the whole delete first.

Nothing writes `show_seats` or `bookings` yet, so the two new 409 rows can't fire today. Add their messages to `RESTRICT_MESSAGES` when the booking module lands; until then the generic `<Entity> is still referenced` applies.

### 23P01 exclusion_violation → 409

| Constraint         | Trigger                                                    | API code         | Message                            |
| ------------------ | ---------------------------------------------------------- | ---------------- | ---------------------------------- |
| `shows_no_overlap` | Show create or `startsAt` update overlaps another show     | `SHOW_CONFLICT`  | Shows on this screen would overlap |
| `shows_no_overlap` | Event `durationMins` update makes two of its shows overlap | `EVENT_CONFLICT` | Shows on this screen would overlap |

`shows_no_overlap` is `EXCLUDE USING gist (screen_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`. The range is half-open, so back-to-back shows pass. Two shows with the same `startsAt` can hit `shows_screen_id_starts_at_key` (23505) instead; both return 409.

**Prisma code depends on the query type.** Through the query API (`show.create`, `show.update`), 23P01 has no Prisma code and arrives as `P2039`. Through raw SQL (`$executeRaw`, `$queryRaw`), Prisma wraps every database error in `P2010`. `toAppError` maps 23P01 under both. Any other `P2010` stays a 500.

The adapter gives no `constraint` field for 23P01, so the name is read from the message, as for 23514.

### 23514 check_violation → 400

| Constraint                                      | Rule                                 | Field          |
| ----------------------------------------------- | ------------------------------------ | -------------- |
| `venues_name_length_check`                      | Trimmed name 1 to 100 chars          | `name`         |
| `venues_city_length_check`                      | Trimmed city 1 to 100 chars          | `city`         |
| `venues_address_length_check`                   | Trimmed address 1 to 500 chars       | `address`      |
| `screens_name_length_check`                     | Trimmed name 1 to 100 chars          | `name`         |
| `seats_row_label_not_empty_check`               | Trimmed row label not empty          | `rowLabel`     |
| `seats_row_label_uppercase_check`               | `row_label = upper(row_label)`       | `rowLabel`     |
| `seats_seat_number_range_check`                 | `seat_number` 1 to 100               | `seatNumber`   |
| `events_title_length_check`                     | Trimmed title 1 to 100 chars         | `title`        |
| `events_description_length_check`               | Trimmed description 20 to 2000 chars | `description`  |
| `events_duration_mins_range_check`              | `duration_mins` 1 to 1440            | `durationMins` |
| `events_language_length_check`                  | Trimmed language exactly 2 chars     | `language`     |
| `shows_price_minor_non_negative_check`          | `price_minor >= 0`                   | `priceMinor`   |
| `seat_categories_sort_order_non_negative_check` | Reference data only                  | 500            |

**Booking tables: server-set columns → 500.** The client never sends these values, so a hit is a bug, not a Zod gap. Booking writes use raw SQL, so the error arrives as `P2010`, which `toAppError` leaves as a 500.

| Constraint                                | Rule                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bookings_status_check`                   | `status` is `pending`, `confirmed`, `cancelled` or `expired`                                                     |
| `bookings_total_minor_non_negative_check` | `total_minor >= 0`                                                                                               |
| `show_seats_status_check`                 | `status` is `available`, `reserved` or `booked`                                                                  |
| `show_seats_version_non_negative_check`   | `version >= 0`                                                                                                   |
| `show_seats_state_check`                  | `available`: no `booking_id`, no `held_until`; `reserved`: both set; `booked`: `booking_id` set, no `held_until` |

### 23502 not_null_violation and 22P02 invalid_text_representation → 400

No named constraint. Use the `column` field from the error for `details`. Both mean Zod let bad input through.
