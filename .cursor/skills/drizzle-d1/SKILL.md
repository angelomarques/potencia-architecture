---
name: drizzle-d1
description: Use when changing the database layer of a Potencia app. Covers the Drizzle schema, generating and applying D1 migrations, the better-auth adapter, and apps that share another app's database.
---

# Drizzle + D1

Drizzle is the data layer. The client is `db` from `src/lib/db` (sqlite-proxy over the D1 HTTP API). `d1Query` / `d1Batch` stay as an escape hatch for SQL Drizzle cannot express. Do not add new raw SQL for ordinary reads and writes.

Column names on `user`, `session`, `account`, and `verification` are the shared D1 contract used by potencia-dashboard and potencia-products. Do not rename them. Property names stay camelCase (`emailVerified` → `email_verified`).

## Flow

1. Edit tables in `src/lib/db/schema.ts`.
2. `pnpm db:generate` — writes SQL into `drizzle/`. Does not connect.
3. Read the new SQL. It must not `DROP`, `RENAME`, or tighten columns that already exist on a shared database.
4. `pnpm db:check` — migration history is consistent. Does not connect.
5. `pnpm db:migrate` — applies `drizzle/` to the D1 database named by `D1_DATABASE_ID`. **Only if this app owns that database.**

Other scripts: `pnpm db:push` (schema diff, easy to drop columns), `pnpm db:studio`.

Credentials are the d1 pack vars in `src/env.ts`: `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`. `drizzle.config.ts` uses driver `d1-http`.

## Shared databases

potencia-products reads and writes the D1 database owned by potencia-dashboard. It must not migrate.

Set `DB_MIGRATIONS=disabled` in that app's env. `pnpm db:migrate` and `pnpm db:push` then exit before talking to Cloudflare. Leave the variable unset only when this app owns the database and is the one allowed to change tables.

## better-auth

`src/lib/auth/auth.ts` uses `drizzleAdapter(db, { provider: "sqlite", transaction: false, schema })`.

`transaction` stays false. D1's HTTP API runs each statement on its own connection, so sqlite-proxy `BEGIN`/`COMMIT` would not be one transaction. The sqlite adapter path uses `RETURNING` and `db.select()` instead. Session loads join `user` through the relations in the schema.

Dates bound by the adapter are stored as integer unix milliseconds (`serializeD1Params`). That matches the existing `created_at` / `expires_at` columns.

## Example

`account.me` in `src/lib/orpc/router.ts` loads the signed-in row with `db.select()`. Row types are exported from `src/lib/db` (`User`, `NewUser`, `SessionRecord`, `AccountRecord`, `VerificationRecord`).

Scaffold copies `drizzle.config.ts`, `drizzle/`, and the db scripts only with the d1 pack. The `account.me` procedure is omitted when auth or d1 is off.
