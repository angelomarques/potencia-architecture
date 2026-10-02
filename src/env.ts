import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed environment — single source of truth for server/client vars.
 * Packs extend server/client schemas when enabled (see packs/<name>/pack.json + scaffold).
 * Set SKIP_ENV_VALIDATION=true for local typecheck/build without secrets.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // ── auth pack ──
    BETTER_AUTH_SECRET: z.string().min(16).optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    // ── turnstile pack ──
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    // ── d1 pack ──
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
    CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
    D1_DATABASE_ID: z.string().min(1).optional(),
    // ── redis pack (Upstash Marketplace / KV_REST_* or UPSTASH_*) ──
    KV_REST_API_URL: z.string().url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  },
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().default("Potencia App"),
    // ── posthog pack: unique short prefix per minted app (scaffold sets this) ──
    NEXT_PUBLIC_EVENT_PREFIX: z
      .string()
      .min(1)
      .max(16)
      .regex(/^[a-z][a-z0-9_-]*$/, "lowercase slug prefix")
      .default("app"),
    // ── turnstile pack ──
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    // ── posthog pack ──
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    D1_DATABASE_ID: process.env.D1_DATABASE_ID,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_EVENT_PREFIX: process.env.NEXT_PUBLIC_EVENT_PREFIX,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  emptyStringAsUndefined: true,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
