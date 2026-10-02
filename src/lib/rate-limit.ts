import { randomBytes } from "crypto";
import { env } from "@/env";
import { getStore } from "./redis";

/** Best-effort ~N req/min per key. Never blocks if store errors. */
export async function checkRateLimit(
  keyId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = env.RATE_LIMIT_PER_MINUTE;
  try {
    const store = getStore();
    const windowKey = `rl:${keyId}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    await store.zremrangebyscore(windowKey, 0, windowStart);
    const count = await store.zcard(windowKey);
    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }
    const member = `${now}:${randomBytes(4).toString("hex")}`;
    await store.zadd(windowKey, now, member);
    return { allowed: true, remaining: Math.max(0, limit - count - 1) };
  } catch (err) {
    console.warn(
      "[rate-limit] best-effort skip:",
      err instanceof Error ? err.message : "error",
    );
    return { allowed: true, remaining: limit };
  }
}
