# ADR-001: Booking data model

- **Status:** Accepted
- **Date:** 2026-11-22
- **Migration:** `prisma/migrations/20261122113619_booking_core`

## Context

Seatlock's core problem is no double booking under heavy demand. Two customers who pick the same seat for the same show at the same moment must not both get it.

To make that safe, the database needs one row that represents "this seat at this show". Concurrent requests can then lock or version-check that row, and exactly one of them wins.

The catalog has `seats` (per screen) and `shows` (per screen and time), but no row that joins the two. A seat exists once, while its availability differs for every show.

## Decision

Add two tables.

- **`show_seats`**: one row per seat per show, keyed by `(show_id, seat_id)`. It holds the seat's state for that show: `status`, `booking_id`, `held_until`, `version`.
- **`bookings`**: one row per customer order for a show. It holds `status`, `customer_ref` and `total_minor`.

### Cost

Rows grow as **seats × shows**. A 200-seat screen with 4 shows a day creates 800 `show_seats` rows a day, about 24,000 a month, for that screen alone.

This is accepted: the rows are narrow, keyed by a composite primary key, and the volume stays small for Postgres. Old shows can be archived later if needed.

### Rejected: availability from bookings alone

Store only bookings and their seats, and treat a seat as free when no active booking covers it.

Rejected because **a free seat has no row to lock**. `SELECT ... FOR UPDATE` only locks rows that exist. Two transactions can both read "no booking for seat A5", both insert, and both succeed. Preventing that would need serializable isolation with retries, advisory locks, or a partial unique index that only fails after the fact. With `show_seats`, the row exists before anyone books, so the database decides the winner directly.

## State machines

### Booking

| From      | To          | When                                |
| --------- | ----------- | ----------------------------------- |
| (new)     | `pending`   | Seats reserved, payment not done    |
| `pending` | `confirmed` | Payment succeeds                    |
| `pending` | `cancelled` | Customer cancels before paying      |
| `pending` | `expired`   | `held_until` passes without payment |

`confirmed`, `cancelled` and `expired` are final. `bookings_status_check` limits `status` to these four values.

### ShowSeat

| From        | To          | When                                         |
| ----------- | ----------- | -------------------------------------------- |
| `available` | `reserved`  | A booking holds the seat                     |
| `reserved`  | `booked`    | The booking is confirmed                     |
| `reserved`  | `available` | The booking is cancelled or its hold expires |

Each status fixes which columns are set. `show_seats_state_check` enforces this in the database, so no code path can leave a seat half-updated:

| Status      | `booking_id` | `held_until` |
| ----------- | ------------ | ------------ |
| `available` | null         | null         |
| `reserved`  | set          | set          |
| `booked`    | set          | null         |

`test/integration/show-seats.int.test.ts` proves the check exists by inserting raw rows that break it.

## Column decisions

### `held_until` instead of `held_at`

`held_until` stores the deadline, set from the database clock: `now() + BOOKING_HOLD_MINUTES`.

With `held_at`, the deadline would be computed on read as `held_at + BOOKING_HOLD_MINUTES`. Changing the config would then move deadlines for holds that already exist, including one a customer was already shown ("pay by 10:15"). Storing the deadline means **a config change never moves a deadline a customer has seen**. It also keeps the expiry query simple: `held_until < now()`.

`BOOKING_HOLD_MINUTES` is validated on startup in `src/config/env.ts` (integer 5 to 30, default 10).

### `total_minor` is a snapshot

`bookings.total_minor` is the price at reservation time, in paise. `PATCH /api/shows/:id` can change `priceMinor` later, and that **must not change what an existing booking costs**. So the total is copied, not computed from the show on read. `bookings_total_minor_non_negative_check` keeps it at 0 or more.

## Foreign key delete rules

Every FK has an explicit `ON DELETE` rule, so a blocked delete raises `23001` (restrict_violation) and maps to 409, as `docs/pg-errors.md` requires. All are `ON UPDATE NO ACTION`.

| FK                           | From → to                 | On delete | Why                                                                     |
| ---------------------------- | ------------------------- | --------- | ----------------------------------------------------------------------- |
| `show_seats_show_id_fkey`    | `show_seats` → `shows`    | CASCADE   | Seat inventory belongs to the show; a show with no bookings takes it    |
| `show_seats_seat_id_fkey`    | `show_seats` → `seats`    | RESTRICT  | A seat that belongs to a scheduled show can't be deleted                |
| `show_seats_booking_id_fkey` | `show_seats` → `bookings` | RESTRICT  | Bookings are never deleted, only cancelled or expired                   |
| `bookings_show_id_fkey`      | `bookings` → `shows`      | RESTRICT  | A show with bookings can't be deleted, since bookings are kept for good |

Deleting a show with bookings is blocked by `bookings_show_id_fkey` before the cascade to `show_seats` runs.

## `updated_at`

Both tables have `updated_at timestamptz DEFAULT now()`, but it is **not** Prisma's `@updatedAt`. Prisma sets `@updatedAt` in the client, only through its query API. Booking writes use raw SQL, so Prisma would never touch it. Instead, every `UPDATE` on these tables sets `updated_at = now()` itself.

## Consequences

- Concurrency control has a concrete row to work on: row locks or a version check on `show_seats.version`. The choice between them is outside this ADR.
- `show_seats` rows must exist before a show can be booked. Nothing creates them yet.
- Two new 409 cases appear once these tables hold data: deleting a seat used by a show, and deleting a show with bookings. Their messages are in `docs/pg-errors.md`.
- `customer_ref` is a placeholder until auth exists.
