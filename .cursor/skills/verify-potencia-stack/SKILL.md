# verify-potencia-stack

Doctor + smoke for the potencia-stack template (and scaffolded apps).

## Feature IDs
- `core-build` — `pnpm install && pnpm build`
- `env-module` — `src/env.ts` present with createEnv
- `pnpm-only` — packageManager field + lockfile
- `scaffold-auth-redis` — scaffold with auth+redis without cf-queues
- `health-route` — `/api/health` returns ok

## Scripts
- `scripts/doctor.sh` — static checks
- `scripts/smoke.sh` — build + optional playwright
- `scripts/cleanup.sh` — remove .next / artifacts

## Usage
```bash
pnpm doctor
pnpm smoke
```
