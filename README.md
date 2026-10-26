# potencia-stack

Private **GitHub template** for Potencia web apps (hybrid option 9).

- **Runtime:** Next.js App Router on **Vercel** (default)
- **Package manager:** **pnpm only** (`packageManager` + `pnpm-lock.yaml`)
- **Env:** typed `src/env.ts` via `@t3-oss/env-nextjs` + `zod`
- **UI:** Tailwind v4 + shadcn/ui (starter shell only — no product UI)
- **Cloudflare:** optional workers under `workers/` only when `cf-cron` / `cf-queues` packs are enabled; D1 via HTTP from Vercel when `d1` pack is on

## Module matrix

| Pack | Default | Purpose |
|------|---------|---------|
| `orpc` | ON | Typed API (oRPC) |
| `auth` | ON | better-auth (email/password); pulls `d1` |
| `posthog` | ON | Product analytics |
| `turnstile` | ON | Cloudflare Turnstile |
| `d1` | ON | Cloudflare D1 over HTTP + Drizzle (Vercel-friendly) |
| `redis` | ON | **Upstash Redis** via Vercel Marketplace (`KV_REST_API_*`) or `UPSTASH_REDIS_REST_*` |
| `cf-cron` | OFF | Cloudflare Worker cron |
| `cf-queues` | OFF | Cloudflare Queues consumer |

Redis note: prefer **Upstash Marketplace** on Vercel (replaces sunset Vercel KV). Env accepts both `KV_REST_API_*` and `UPSTASH_REDIS_REST_*`.

## Mint a new app (Ari / agents)

### A) GitHub “Use this template”

```bash
gh repo create my-app --private --template angelomarques/potencia-stack --clone
cd my-app
pnpm install
cp .env.example .env.local   # fill secrets — never commit
pnpm dev
```

Then trim packs if needed with the scaffold against a fresh copy, or delete unused pack files and deps.

### B) Scaffold CLI (feature flags)

From a clone of this template:

```bash
pnpm scaffold -- --name my-app --with-auth --with-redis --without-cf-queues
cd ../my-app
pnpm install
pnpm build
```

Explicit pack list:

```bash
pnpm scaffold -- --name my-app --packs orpc,auth,redis,turnstile,d1,posthog
```

### C) Grok Bot / Antigravity path

1. Clone `angelomarques/potencia-stack` via SSH (`id_ed25519_github`).
2. Follow `.cursor/skills/new-potencia-stack/SKILL.md`.
3. Run `pnpm scaffold` with the requested packs.
4. `gh repo create <name> --private` + push; link Vercel; copy env from `.env.example` (never paste secret values into chat).
5. Verify with `.cursor/skills/verify-potencia-stack/` (`pnpm run doctor` / `pnpm smoke`).

## Develop this template

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # uses SKIP_ENV_VALIDATION=true
pnpm run doctor
pnpm smoke
```

`src/env.ts` is imported from `next.config.ts` so invalid env fails the build unless `SKIP_ENV_VALIDATION=true`.

## Database (Drizzle)

D1 is reached with Drizzle's sqlite-proxy (`src/lib/db`). App queries go through `db`. `d1Query` remains for one-off SQL.

```bash
pnpm db:generate   # schema → drizzle/*.sql (no network)
pnpm db:check      # migration history (no network)
pnpm db:migrate    # apply drizzle/ to D1_DATABASE_ID
pnpm db:push       # schema diff against D1 — easy to drop columns
pnpm db:studio
```

`drizzle.config.ts` uses dialect `sqlite` and driver `d1-http` with `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN`.

better-auth uses `drizzleAdapter` (`provider: "sqlite"`, `transaction: false`) against the same `db`. Column names match the tables already deployed for potencia-dashboard and potencia-products (`email_verified`, `created_at`, `user_id`, …). Do not rename them.

**Shared database:** an app that uses another app's D1 (potencia-products uses potencia-dashboard's database) sets `DB_MIGRATIONS=disabled`. `pnpm db:migrate` and `pnpm db:push` exit before any request. Only the owning app migrates.

Skill: `.cursor/skills/drizzle-d1/SKILL.md`. Example read: oRPC `account.me` (`db.select()`). Row types: `User`, `SessionRecord`, `AccountRecord`, `VerificationRecord` from `@/lib/db`.



## Forms (required)

Agents and humans must build forms with **react-hook-form + zod + shadcn Form**.

- Cursor rule: `.cursor/rules/forms.mdc` (`alwaysApply`)
- UI: `src/components/ui/form.tsx`, `input.tsx`, `label.tsx`
- Example: `src/app/(auth)/sign-in/page.tsx` (no signup page in the template MVP)

## Analytics (PostHog)

- Browser: `src/components/analytics/posthog-provider.tsx` (`posthog-js`)
- Server: `src/lib/analytics.ts` — `Analytics.track` / `identify` / `shutdown` / `isInitialized` (`posthog-node`, `server-only`)
- Shared PostHog project is fine; events are namespaced with **`NEXT_PUBLIC_EVENT_PREFIX`**
- Template default prefix: `app`
- On mint, scaffold sets a unique short prefix from `--name` (e.g. `kingdom-movies` → `km`, `potencia-dashboard` → `pd`) into `.env.example` and `potencia.packs.json`
- Skill: `.cursor/skills/new-potencia-stack/SKILL.md` documents the prefix step

## Deploy

1. **Vercel** — import the new repo; set env from `.env.example`.
2. **Upstash** — Vercel Marketplace → Upstash Redis (fills `KV_REST_API_*`).
3. **Cloudflare** — only if using `d1` / `cf-cron` / `cf-queues`; workers live under `workers/` when those packs are enabled.

## License / notes

Internal Potencia boilerplate. Do not invent product pages in this repo — keep the starter shell.
