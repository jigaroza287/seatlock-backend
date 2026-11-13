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
| `23001`  | restrict_violation          | Delete blocked by `ON DELETE RESTRICT`       | **409** | `<ENTITY>_CONFLICT`     |
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
| `screens_venue_id_name_key`                 | Same screen name at the same venue       | `SCREEN_CONFLICT` | A screen with this name already exists at this venue |
| `seats_screen_id_row_label_seat_number_key` | Same row and number on the same screen   | `SEAT_CONFLICT`   | This seat already exists on this screen              |
| `events_title_lower_key`                    | Duplicate event title                    | `EVENT_CONFLICT`  | An event with this title already exists              |
| `shows_screen_id_starts_at_key`             | Two shows on one screen at the same time | `SHOW_CONFLICT`   | This screen already has a show at this time          |
| `seat_categories_sort_order_key`            | Reference data only                      | n/a               | 500                                                  |

### 23503 foreign_key_violation (insert or update) → 400

| Constraint              | Field      | Message                |
| ----------------------- | ---------- | ---------------------- |
| `screens_venue_id_fkey` | `venueId`  | Venue does not exist   |
| `seats_screen_id_fkey`  | `screenId` | Screen does not exist  |
| `seats_category_fkey`   | `category` | Unknown seat category  |
| `events_category_fkey`  | `category` | Unknown event category |
| `shows_event_id_fkey`   | `eventId`  | Event does not exist   |
| `shows_screen_id_fkey`  | `screenId` | Screen does not exist  |

Put the field in `details`, e.g. `[{ field: "venueId", message: "Venue does not exist" }]`, so it matches the Zod error shape.

### 23001 restrict_violation (delete) → 409

| Constraint                                    | Trigger                         | API code          | Message                    |
| --------------------------------------------- | ------------------------------- | ----------------- | -------------------------- |
| `screens_venue_id_fkey`                       | Delete a venue that has screens | `VENUE_CONFLICT`  | Venue still has screens    |
| `shows_screen_id_fkey`                        | Delete a screen that has shows  | `SCREEN_CONFLICT` | Screen has scheduled shows |
| `shows_event_id_fkey`                         | Delete an event that has shows  | `EVENT_CONFLICT`  | Event has scheduled shows  |
| `seats_category_fkey`, `events_category_fkey` | Delete a lookup row             | n/a               | 500                        |

`seats_screen_id_fkey` is `ON DELETE CASCADE`: deleting a screen removes its seats with no error. If the screen has shows, `shows_screen_id_fkey` blocks the whole delete first.

### 23514 check_violation → 400

| Constraint                                      | Rule                                 | Field          |
| ----------------------------------------------- | ------------------------------------ | -------------- |
| `venues_name_length_check`                      | Trimmed name 1 to 100 chars          | `name`         |
| `venues_city_length_check`                      | Trimmed city 1 to 100 chars          | `city`         |
| `screens_name_length_check`                     | Trimmed name 1 to 100 chars          | `name`         |
| `seats_row_label_not_empty_check`               | Trimmed row label not empty          | `rowLabel`     |
| `seats_seat_number_range_check`                 | `seat_number` 1 to 100               | `seatNumber`   |
| `events_title_length_check`                     | Trimmed title 1 to 100 chars         | `title`        |
| `events_description_length_check`               | Trimmed description 20 to 2000 chars | `description`  |
| `events_duration_mins_range_check`              | `duration_mins` 1 to 1440            | `durationMins` |
| `events_language_length_check`                  | Trimmed language exactly 2 chars     | `language`     |
| `shows_price_minor_non_negative_check`          | `price_minor >= 0`                   | `priceMinor`   |
| `seat_categories_sort_order_non_negative_check` | Reference data only                  | 500            |

### 23502 not_null_violation and 22P02 invalid_text_representation → 400

No named constraint. Use the `column` field from the error for `details`. Both mean Zod let bad input through.
