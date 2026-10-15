import { env } from "@/env";
import { QA_BYPASS_HEADER, verifyQaBypassToken } from "./qa-bypass-token";

export { QA_BYPASS_HEADER } from "./qa-bypass-token";

/** 20 bypass uses per IP per hour. */
export const QA_BYPASS_RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

/**
 * Default limiter: in-process fixed window, so the turnstile pack works without the
 * redis pack. Apps with a shared store can pass `rateLimit` (e.g. wrap
 * `checkRateLimit` from the redis pack) via deps for a cross-instance limit.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
export async function memoryQaBypassRateLimit(key: string): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + QA_BYPASS_RATE_LIMIT.windowMs });
    return { allowed: true };
  }
  b.count += 1;
  return { allowed: b.count <= QA_BYPASS_RATE_LIMIT.limit };
}
export function resetQaBypassRateLimit(): void {
  buckets.clear();
}

export type QaBypassDeps = {
  secret?: string | null;
  nowSeconds?: number;
  rateLimit?: (key: string) => Promise<{ allowed: boolean }>;
  log?: (line: string) => void;
};

/**
 * Opt-in QA bypass for Turnstile-protected routes. Returns true ONLY when
 * QA_BYPASS_SECRET is set, the header carries a valid token for `scope`, and the
 * per-IP bypass rate limit allows it. Callers must still run validation,
 * rate limits, auth and side effects — this only replaces the siteverify call.
 */
export async function checkQaBypass(
  input: { headers: Headers; scope: string; ip?: string | null },
  deps: QaBypassDeps = {},
): Promise<boolean> {
  const secret = "secret" in deps ? deps.secret : env.QA_BYPASS_SECRET;
  if (!secret) return false;
  const token = input.headers.get(QA_BYPASS_HEADER);
  if (!token) return false;

  const ip = input.ip?.trim() || "unknown";
  const log = deps.log ?? ((line: string) => console.info(line));
  const result = verifyQaBypassToken({ token, scope: input.scope, secret, nowSeconds: deps.nowSeconds });
  if (!result.ok) {
    log(`[qa-bypass] rejected route=${input.scope} ip=${ip} reason=${result.reason}`);
    return false;
  }

  const rateLimit = deps.rateLimit ?? memoryQaBypassRateLimit;
  const { allowed } = await rateLimit(`qa-bypass:${ip}`);
  if (!allowed) {
    log(`[qa-bypass] rate_limited route=${input.scope} ip=${ip} issuedAt=${result.issuedAt}`);
    return false;
  }

  log(`[qa-bypass] used route=${input.scope} ip=${ip} issuedAt=${result.issuedAt}`);
  return true;
}
