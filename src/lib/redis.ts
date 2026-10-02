import { Redis } from "@upstash/redis";
import { env } from "@/env";

type Store = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  backend: "upstash" | "memory";
};

const memory = new Map<string, { value: unknown; expiresAt?: number }>();
const memoryZ = new Map<string, Map<string, number>>();
let warnedMemory = false;

function memGet(key: string): unknown | null {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt !== undefined && Date.now() > row.expiresAt) {
    memory.delete(key);
    return null;
  }
  return row.value;
}

function createMemoryStore(): Store {
  if (!warnedMemory) {
    console.warn(
      "[redis] Upstash/KV env missing — in-memory Map (local only; not shared)",
    );
    warnedMemory = true;
  }
  return {
    backend: "memory",
    async get<T = unknown>(key: string) {
      return memGet(key) as T | null;
    },
    async set(key, value, opts) {
      memory.set(key, {
        value,
        expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : undefined,
      });
    },
    async del(key) {
      memory.delete(key);
      memoryZ.delete(key);
    },
    async zadd(key, score, member) {
      let z = memoryZ.get(key);
      if (!z) {
        z = new Map();
        memoryZ.set(key, z);
      }
      z.set(member, score);
      return 1;
    },
    async zremrangebyscore(key, min, max) {
      const z = memoryZ.get(key);
      if (!z) return 0;
      let n = 0;
      for (const [m, s] of z) {
        if (s >= min && s <= max) {
          z.delete(m);
          n += 1;
        }
      }
      return n;
    },
    async zcard(key) {
      return memoryZ.get(key)?.size ?? 0;
    },
  };
}

function createUpstashStore(url: string, token: string): Store {
  const redis = new Redis({ url, token });
  return {
    backend: "upstash",
    async get<T = unknown>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async set(key, value, opts) {
      if (opts?.ex) await redis.set(key, value, { ex: opts.ex });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async zadd(key, score, member) {
      return Number(await redis.zadd(key, { score, member }));
    },
    async zremrangebyscore(key, min, max) {
      return Number(await redis.zremrangebyscore(key, min, max));
    },
    async zcard(key) {
      return Number(await redis.zcard(key));
    },
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  cached =
    url && token ? createUpstashStore(url, token) : createMemoryStore();
  return cached;
}

export type { Store };
