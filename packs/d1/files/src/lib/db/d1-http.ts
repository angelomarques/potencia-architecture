/**
 * Cloudflare D1 via REST/HTTP API — works on Vercel (no Workers binding).
 */
import { env } from "@/env";
import { createExternalClient, HttpError } from "@/lib/http";

const cloudflare = createExternalClient({
  baseURL: "https://api.cloudflare.com/client/v4",
  timeout: 15_000,
});

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

/**
 * sqlite-proxy binds Date instances for better-auth timestamps.
 * JSON would send those as ISO strings; the shared columns are integer unix ms.
 */
export function serializeD1Params(params: readonly unknown[]): unknown[] {
  return params.map((value) => (value instanceof Date ? value.getTime() : value));
}

/** POST to the D1 query endpoint. Writes are not retried (POST is non-idempotent). */
async function postD1(path: string, token: string, payload: unknown): Promise<D1Result> {
  try {
    const { data } = await cloudflare.post<D1Result>(path, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (err) {
    if (err instanceof HttpError && err.data && typeof err.data === "object") {
      return { ...(err.data as D1Result), success: false };
    }
    throw err;
  }
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ results: T[]; meta?: Record<string, unknown> }> {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID);
  const dbId = requireEnv("D1_DATABASE_ID", env.D1_DATABASE_ID);
  const token = requireEnv("CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN);

  const data = await postD1(
    `/accounts/${accountId}/d1/database/${dbId}/query`,
    token,
    { sql, params: serializeD1Params(params) },
  );
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? "D1 query failed";
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

  const data = await postD1(
    `/accounts/${accountId}/d1/database/${dbId}/query`,
    token,
    statements.map((s) => ({ sql: s.sql, params: serializeD1Params(s.params ?? []) })),
  );
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? "D1 batch failed";
    throw new Error(msg);
  }
}
