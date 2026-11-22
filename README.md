# seatlock-backend

Backend for Seatlock, a ticket booking platform. Core problem: **no double booking under heavy demand**. Current scope is the event catalog API.

**Stack:** Node 24, TypeScript, Express 5, Zod 4, Prisma 7 (`@prisma/adapter-pg`), Postgres 18 in Docker, Vitest, Supertest.

## Prerequisites

- Node 24 (`.nvmrc`)
- pnpm 12 (`corepack enable`)
- Docker with Compose

## Setup

```bash
pnpm install
cp .env.example .env        # then set POSTGRES_PASSWORD and the same password in DATABASE_URL
pnpm db:generate            # Reads schema.prisma and generates Prisma client code
pnpm db:up                  # Postgres on 127.0.0.1:5433
pnpm db:migrate && pnpm db:seed
pnpm dev                    # API on http://localhost:8000
```

Adminer (database UI): `docker compose up -d adminer`, then http://localhost:8080. Server: `db`.

## Run the API in Docker

```bash
pnpm db:up && pnpm db:migrate # migrations run from your machine
docker compose up -d --build api # API on http://localhost:8000
```

Stop `pnpm dev` first: both use port 8000. Inside Compose the API reaches Postgres at `db:5432`.

## Environment variables

| Variable               | Used by         | Purpose                                                                                |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `PORT`                 | API             | HTTP port, default `8000`                                                              |
| `POSTGRES_USER`        | Docker          | Database user created on first start                                                   |
| `POSTGRES_PASSWORD`    | Docker          | Password for that user; required                                                       |
| `POSTGRES_DB`          | Docker          | Database created on first start                                                        |
| `DB_PORT`              | Docker          | Host port for Postgres; `5433` avoids a local Postgres on `5432`                       |
| `DATABASE_URL`         | API, Prisma CLI | Connection string; must match the four values above                                    |
| `BOOKING_HOLD_MINUTES` | API             | How long a reserved seat is held, integer 5 to 30, default `10`; invalid stops startup |

Postgres applies `POSTGRES_*` only when the volume is first created. After changing them, run `docker compose down -v` (deletes data) or update the user with `ALTER USER`.

## Tests

| Command              | Runs                                                           | Needs Docker |
| -------------------- | -------------------------------------------------------------- | ------------ |
| `pnpm test`          | Unit and route tests (`src/**/__tests__`)                      | No           |
| `pnpm test:coverage` | Same, with a coverage report                                   | No           |
| `pnpm test:int`      | Integration tests against a real database (`test/integration`) | Yes          |

**One-time setup for integration tests:**

```bash
docker compose exec db psql -U seatlock -d seatlock -c "CREATE DATABASE seatlock_test;"
```

Then create `.env.test` with:

```
DATABASE_URL=postgresql://seatlock:<password>@localhost:5433/seatlock_test
```

Integration tests apply migrations and truncate data tables before each test. They refuse to run unless the database name ends in `_test`.

## Scripts

| Script                              | Does                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| `dev`                               | Watch mode, loads `.env`                                      |
| `build` / `start`                   | Generate the Prisma client and compile to `dist`, then run it |
| `typecheck`, `lint`, `format:check` | Static checks                                                 |
| `db:up`                             | Start Postgres                                                |
| `db:migrate`                        | Apply pending migrations (never resets)                       |
| `db:seed`                           | Load sample data from `sql/seed.sql`                          |
| `db:generate`                       | Regenerate the Prisma client after schema changes             |

## API

Routes, request bodies, status codes and the error shape: [`docs/api-contract.md`](docs/api-contract.md).
Database error to HTTP mapping: [`docs/pg-errors.md`](docs/pg-errors.md).

## Project layout

```
src/
  server.ts            entry: checks the database, listens, graceful shutdown
  app.ts               Express app: middleware, routes, 404, error handler
  config/env.ts        env vars parsed with Zod on startup
  db/prisma.ts         Prisma client and connection pool
  middleware/          request id, error handler
  modules/events/      routes, controller, service, repository, schemas, tests
  shared/              AppError, Prisma error mapping, shared schemas
prisma/                schema.prisma, migrations/
sql/                   seed.sql, original DDL, practice queries
test/integration/      database-backed tests
docs/                  API contract, error mapping
```
