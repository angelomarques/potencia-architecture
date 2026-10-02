/**
 * Cloudflare D1 via REST/HTTP API — works on Vercel (no Workers binding).
 */
import { env } from "@/env";

type D1Result = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: Array<{
    results: Record<string, unknown>[];
    success: boolean;
    meta?: Record<string, unknown>;
  }>;
};

function requireEnv(name: keyof typeof env, value: string | undefined): string {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ results: T[]; meta?: Record<string, unknown> }> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID);
  const dbId = requireEnv("D1_DATABASE_ID", env.D1_DATABASE_ID);
  const token = requireEnv("CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    },
  );

  const data = (await res.json()) as D1Result;
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `D1 query failed (${res.status})`;
    throw new Error(msg);
  }
  const batch = data.result?.[0];
  return {
    results: (batch?.results ?? []) as T[],
    meta: batch?.meta,
  };
}

export async function d1Batch(
  statements: { sql: string; params?: unknown[] }[],
): Promise<void> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID);
  const dbId = requireEnv("D1_DATABASE_ID", env.D1_DATABASE_ID);
  const token = requireEnv("CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
      ),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as D1Result;
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `D1 batch failed (${res.status})`;
    throw new Error(msg);
  }
}
