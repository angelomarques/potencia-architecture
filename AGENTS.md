# AGENTS — potencia-stack

## Rules
- **pnpm only** — never npm/yarn. Respect `packageManager` in package.json.
- Env lives in **`src/env.ts`** (`@t3-oss/env-nextjs` + zod). Packs extend `server` / `client` when enabled.
- **Forms:** always **react-hook-form + zod + shadcn Form** — see `.cursor/rules/forms.mdc`. Example: `src/app/(auth)/sign-in/page.tsx`.
- **Analytics:** server `Analytics` in `src/lib/analytics.ts` (posthog-node). Events use `NEXT_PUBLIC_EVENT_PREFIX` (unique per app; scaffold derives from `--name`). Never hardcode `lw`.
- Never paste secret values into chat, commits, or PRs.
- Do not invent product UI in this template.
- Prefer SSH for git: `GIT_SSH_COMMAND='ssh -i /home/box/agent-data/secrets/ssh/id_ed25519_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new'`.
- Cloudflare Workers only for cron/queues/d1 bindings needs — not OpenNext-everywhere.

## Skills
- `.cursor/skills/new-potencia-stack/` — mint a new app from this template
- `.cursor/skills/verify-potencia-stack/` — doctor + smoke

## Scaffold
`pnpm scaffold -- --name <app> [--with-<pack>|--without-<pack>|--packs a,b]`
