import { drizzle, type AsyncRemoteCallback } from "drizzle-orm/sqlite-proxy";
import { d1Query } from "./d1-http";
import * as schema from "./schema";

type ProxyMethod = "run" | "all" | "values" | "get";

/** Relational queries select json_array(...). D1 may hand that back as text or as a parsed array. */
function proxyCell(value: unknown): unknown {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

/**
 * D1 returns named objects. sqlite-proxy wants values in SELECT order.
 * `meta.changes` is what the better-auth adapter reads for updateMany/deleteMany.
 */
export function toProxyResult(
  method: ProxyMethod,
  results: Record<string, unknown>[],
  meta?: Record<string, unknown>,
): { rows: unknown[]; meta?: Record<string, unknown> } {
  const rows = results.map((row) => Object.values(row).map(proxyCell));
  switch (method) {
    case "run":
      return meta ? { rows: [], meta } : { rows: [] };
    case "get":
      return { rows: rows[0] as unknown[] };
    case "all":
    case "values":
      return meta ? { rows, meta } : { rows };
    default: {
      const exhaustive: never = method;
      return exhaustive;
    }
  }
}

const proxy: AsyncRemoteCallback = async (sql, params, method) => {
  const { results, meta } = await d1Query<Record<string, unknown>>(sql, params);
  return toProxyResult(method, results, meta);
};

export const db = drizzle(proxy, { schema, logger: false });

export { schema };
export type {
  AccountRecord,
  NewAccountRecord,
  NewSessionRecord,
  NewUser,
  NewVerificationRecord,
  SessionRecord,
  User,
  VerificationRecord,
} from "./schema";
export { d1Query, d1Batch } from "./d1-http";
