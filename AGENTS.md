# AGENTS — potencia-stack

## Rules
- **pnpm only** — never npm/yarn. Respect `packageManager` in package.json.
- Env lives in **`src/env.ts`** (`@t3-oss/env-nextjs` + zod). Packs extend `server` / `client` when enabled.
- **Forms:** always **react-hook-form + zod + shadcn Form** — see `.cursor/rules/forms.mdc`. Example: `src/app/(auth)/sign-in/page.tsx`.
- **Analytics:** server `Analytics` in `src/lib/analytics.ts` (posthog-node). Events use `NEXT_PUBLIC_EVENT_PREFIX` (unique per app; scaffold derives from `--name`). Never hardcode `lw`.
- **Help forms:** server event `${prefix}_help_center_submitted` with `email`/`message`/`accountEmail` → shows in potencia-dashboard. See `.cursor/rules/help-form.mdc`.
- **HTTP:** always **axios** via `@/lib/http` — `http` / `createExternalClient` for external APIs (timeouts, idempotent retry, `HttpError`), `api` for internal `/api/*` (baseURL from `NEXT_PUBLIC_APP_URL`, credentials). No raw `fetch()` — enforced by ESLint + `pnpm doctor`. Exceptions (oRPC `RPCLink`, Next cache, SDK internals) in `.cursor/rules/http-axios.mdc`.
- Never paste secret values into chat, commits, or PRs.
- **Turnstile QA bypass:** Turnstile-protected routes call `verifyTurnstileOrQaBypass()` (`src/lib/auth/turnstile.ts`). Opt-in via `QA_BYPASS_SECRET`; header `x-potencia-qa-bypass`; mint with `node scripts/qa-bypass-token.mjs <scope>`. Skips only siteverify — see `.cursor/skills/qa-bypass/`.
- Do not invent product UI in this template.
- Prefer SSH for git: `GIT_SSH_COMMAND='ssh -i /home/box/agent-data/secrets/ssh/id_ed25519_github -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new'`.
- Cloudflare Workers only for cron/queues/d1 bindings needs — not OpenNext-everywhere.

## Skills
- `.cursor/skills/new-potencia-stack/` — mint a new app from this template
- `.cursor/skills/verify-potencia-stack/` — doctor + smoke
- `.cursor/skills/qa-bypass/` — opt-in Turnstile bypass for production QA (tokens, wiring, tests)
- `.cursor/skills/help-form/` — help/support form that appears in potencia-dashboard Help Center
- `.cursor/skills/design-system-landing/` — new visual design system or marketing / local-business landing (DESIGN.md first)
- `.cursor/skills/feature-branch-workflow/` — opt-in stacked PRs for big features (off unless Ângelo asks, or the project switch in that skill is turned on)

## Scaffold
`pnpm scaffold -- --name <app> [--with-<pack>|--without-<pack>|--packs a,b]`
