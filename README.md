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
| `d1` | ON | Cloudflare D1 over HTTP (Vercel-friendly) |
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
5. Verify with `.cursor/skills/verify-potencia-stack/` (`pnpm doctor` / `pnpm smoke`).

## Develop this template

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # uses SKIP_ENV_VALIDATION=true
pnpm doctor
pnpm smoke
```

`src/env.ts` is imported from `next.config.ts` so invalid env fails the build unless `SKIP_ENV_VALIDATION=true`.

## Deploy

1. **Vercel** — import the new repo; set env from `.env.example`.
2. **Upstash** — Vercel Marketplace → Upstash Redis (fills `KV_REST_API_*`).
3. **Cloudflare** — only if using `d1` / `cf-cron` / `cf-queues`; workers live under `workers/` when those packs are enabled.

## License / notes

Internal Potencia boilerplate. Do not invent product pages in this repo — keep the starter shell.
