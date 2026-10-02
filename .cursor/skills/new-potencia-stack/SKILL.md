# new-potencia-stack

Mint a new Potencia web app from the `angelomarques/potencia-stack` GitHub template.

## When to use
Creating a new Next.js Potencia app with optional packs (auth, orpc, redis, turnstile, d1, posthog, cf-cron, cf-queues).

## Steps
1. **Clone template** (SSH):
   ```bash
   export GIT_SSH_COMMAND='ssh -i /home/box/agent-data/secrets/ssh/id_ed25519_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new'
   git clone git@github.com:angelomarques/potencia-stack.git /tmp/potencia-stack-src
   cd /tmp/potencia-stack-src
   pnpm install
   ```
2. **Scaffold** with feature flags (example: auth+redis, no queues):
   ```bash
   pnpm scaffold -- --name my-app --with-auth --with-redis --without-cf-queues --without-cf-cron
   ```
3. **Create GitHub repo + push**:
   ```bash
   source /home/box/agent-data/secrets/gh.env   # never paste token
   cd ../my-app
   git init -b main
   git add -A && git commit -m "chore: scaffold from potencia-stack"
   gh repo create angelomarques/my-app --private --source=. --remote=origin --push
   ```
   Or: `gh repo create my-app --private --template angelomarques/potencia-stack --clone` then re-run scaffold overlays if packs differ.
4. **Vercel**: `vercel link` / import repo; copy keys from `.env.example` into project env (do not echo secrets).
5. **Upstash**: Marketplace → Redis if `redis` pack enabled.
6. **Verify**: follow `verify-potencia-stack` skill (`pnpm doctor`, `pnpm build`).

## Pack defaults
See `packs/defaults.json`: orpc/auth/posthog/turnstile/d1/redis ON; cf-cron/cf-queues OFF.

## Env
Single file `src/env.ts`. Packs document schema fragments in `packs/*/pack.json` → `env`. Scaffold does not auto-rewrite env.ts yet — template ships optional schemas for default-ON packs; strip unused keys when disabling packs for production hygiene.
