# Catalog CRUD brief

Read this before building any catalog module. `docs/api-contract.md` decides **what** to build and `CLAUDE.md` decides **how** code is organised. This brief only adds the build order, scope and implementation decisions that neither of them covers.

## How to use

- One module per session, in this order: **venues, screens, seats, shows**. Stop after each module for review. Don't commit.
- Pattern to follow: `src/modules/events/` with its `__tests__/`, and `test/integration/events.int.test.ts`.
- If something isn't covered by the contract, `CLAUDE.md` or this brief, stop and ask. Don't guess.

## Scope

- **No migrations and no `schema.prisma` edits.** Every catalog table already exists.
- **Out of scope** (built by hand later): seat layout generation, show `endsAt` and overlap rules, `show_seats`, bookings.

## Decisions

### Path params

`shared/schema.ts` gets one schema per nested param, next to `idParamSchema`:

```ts
export const venueIdParamSchema = z.object({ venueId: z.uuid() });
export const screenIdParamSchema = z.object({ screenId: z.uuid() });
```

### Routers

- Venues and shows: same as events, mounted at `/api/venues` and `/api/shows`.
- Screens and seats: one router per module with full paths (`/venues/:venueId/screens` and `/screens/:id`), mounted at `/api` in `app.ts`.

### Parent in the path returns 404

- **Create:** don't check the parent first. Let the insert run and map the parent's FK error to `<PARENT>_NOT_FOUND`. Each FK below only ever receives an id from the path, so the constraint name is enough.
  - In `shared/prisma-error.ts`, add a `PATH_PARENT_FKS` map: `screens_venue_id_fkey` to `Venue`, `seats_screen_id_fkey` to `Screen`. Remove both from `FOREIGN_KEY_FIELDS`.
  - On `P2003` for a non-delete operation, check `PATH_PARENT_FKS` first and return `AppError.notFound(entity, ...)`. Everything else maps as today.
  - Move the same two rows in `docs/pg-errors.md` from 400 to 404.
  - If an FK ever gets ids from both the path and a body, this map stops working. Revisit it then.
- **Nested list:** no insert, so no FK error. The service looks up the parent first and throws `<PARENT>_NOT_FOUND`. Inject the parent's repository interface into the service constructor (for example `ScreenService(screenRepo, venueRepo)`).

### Show timestamps

The domain type uses `string` for `startsAt`. The repository converts to `Date` for Prisma and back with `toISOString()`. The service never sees `Date`.

## Review checklist (for the reviewer)

- [ ] Status and error codes match the contract table, including `<PARENT>_NOT_FOUND` vs `VALIDATION_ERROR`
- [ ] `Location` points to the flat item route
- [ ] `I`-prefixed interfaces, plain class names, no Prisma types outside the repository
- [ ] No check-then-insert; parent 404 on create comes from the FK mapping
- [ ] Zod limits match the contract; `.strict()` on create and update
- [ ] Sort keys match the contract
- [ ] Every error in the contract's endpoint table has a test
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm test:int` pass, twice in a row for integration
- [ ] I can explain every file without opening the events module

## Session prompt

Replace `{Module}` and `{module}` with the target, for example `Venue` and `venues`.

```text
Read CLAUDE.md, docs/catalog-brief.md and the {Module} section of docs/api-contract.md. Build the {module} module only, following src/modules/events. Don't commit. Before writing code, list anything unclear.
```
