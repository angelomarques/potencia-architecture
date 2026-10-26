import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit → Cloudflare D1 over HTTPS.
 * Credential names match the d1 pack vars in src/env.ts:
 * CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID, CLOUDFLARE_API_TOKEN.
 * `generate` and `check` do not connect. `migrate`, `push`, and `studio` do.
 * Apps that share another app's database set DB_MIGRATIONS=disabled
 * (see .cursor/skills/drizzle-d1). pnpm db:migrate / db:push then refuse.
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: process.env.D1_DATABASE_ID ?? "",
    token: process.env.CLOUDFLARE_API_TOKEN ?? "",
  },
});
