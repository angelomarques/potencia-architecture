import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    /**
     * D1's HTTP API runs each statement on its own. Interactive BEGIN/COMMIT
     * from sqlite-proxy would not be one transaction, so leave this off
     * (the adapter default). SQLite writes use RETURNING instead.
     */
    transaction: false,
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
  trustedOrigins: [env.BETTER_AUTH_URL || "http://localhost:3000"].filter(
    Boolean,
  ) as string[],
  secret: env.BETTER_AUTH_SECRET ?? "dev-only-insecure-change-me-32chars!!",
  baseURL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
