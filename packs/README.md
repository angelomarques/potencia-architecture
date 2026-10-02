# Feature packs

Each pack is a folder under `packs/<name>/` with:

- `pack.json` — metadata, dependencies, env schema fragments, default on/off
- `files/` — overlay paths copied into the app when the pack is enabled (relative to repo root)

Scaffold (`pnpm create` / `scripts/scaffold.mjs`) merges selected packs into a new app.
**Default OFF packs must not leave dead code in a scaffolded app.**

| Pack | Default | Purpose |
|------|---------|---------|
| orpc | ON | Typed API layer (oRPC) |
| auth | ON | better-auth email/password |
| posthog | ON | Product analytics |
| turnstile | ON | Cloudflare Turnstile |
| d1 | ON | Cloudflare D1 via HTTP (Vercel-friendly) |
| redis | ON | Upstash Redis / Vercel Marketplace KV rate limit |
| cf-cron | OFF | Cloudflare Worker cron triggers |
| cf-queues | OFF | Cloudflare Queues consumer worker |
