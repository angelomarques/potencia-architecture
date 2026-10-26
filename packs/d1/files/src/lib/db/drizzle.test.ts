import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { serializeD1Params } from "./d1-http";
import { toProxyResult } from "./index";
import * as schema from "./schema";

const root = path.resolve(import.meta.dirname, "../../..");

describe("serializeD1Params", () => {
  test("stores better-auth Dates as unix milliseconds", () => {
    const at = new Date("2026-01-02T03:04:05.000Z");
    assert.deepEqual(serializeD1Params([at, "ok", null, false]), [at.getTime(), "ok", null, false]);
    assert.equal(JSON.stringify(serializeD1Params([at])).includes("2026-01-02"), false);
  });
});

describe("sqlite-proxy mapping", () => {
  test("select uses snake_case columns and boolean mode", async () => {
    const sqls: string[] = [];
    const db = drizzle(async (sql, _params, method) => {
      sqls.push(sql);
      return toProxyResult(method, [
        {
          id: "u1",
          name: "Ada",
          email: "ada@example.com",
          email_verified: 1,
          image: null,
          created_at: 1_700_000_000_000,
          updated_at: 1_700_000_000_001,
        },
      ]);
    });

    const rows = await db.select().from(schema.user).where(eq(schema.user.id, "u1"));
    const row: schema.User = rows[0];
    assert.equal(row.emailVerified, true);
    assert.equal(row.email, "ada@example.com");
    assert.match(sqls[0], /"email_verified"/);
    assert.equal(sqls[0].includes("emailVerified"), false);
  });

  test("session join maps a parsed json_array user cell", async () => {
    const record = {
      id: "s1",
      expires_at: 1_800_000_000_000,
      token: "tok",
      created_at: 1,
      updated_at: 1,
      ip_address: null,
      user_agent: null,
      user_id: "u1",
      user: ["u1", "Ada", "ada@example.com", 0, null, 1, 2],
    };
    const db = drizzle(
      async (_sql, _params, method) => toProxyResult(method, [record]),
      { schema },
    );
    const row = await db.query.session.findFirst({
      where: eq(schema.session.token, "tok"),
      with: { user: true },
    });
    assert.equal(row?.userId, "u1");
    assert.equal(row?.user.email, "ada@example.com");
    assert.equal(row?.user.emailVerified, false);
  });

  test("run results keep D1 meta.changes for the auth adapter", () => {
    const result = toProxyResult("run", [], { changes: 2 });
    assert.equal(result.meta?.changes, 2);
    assert.deepEqual(result.rows, []);
  });
});

describe("initial migration", () => {
  const sql = fs.readFileSync(path.join(root, "drizzle/0000_better_auth.sql"), "utf8");

  test("creates the shared better-auth tables and does not alter or drop", () => {
    for (const table of ["user", "session", "account", "verification"]) {
      assert.match(sql, new RegExp(`CREATE TABLE \`${table}\``));
    }
    for (const column of [
      "email_verified",
      "created_at",
      "updated_at",
      "expires_at",
      "ip_address",
      "user_agent",
      "user_id",
      "account_id",
      "provider_id",
      "access_token",
      "refresh_token",
      "id_token",
      "access_token_expires_at",
      "refresh_token_expires_at",
    ]) {
      assert.match(sql, new RegExp(`\`${column}\``));
    }
    assert.match(sql, /`email_verified` integer DEFAULT 0 NOT NULL/);
    assert.equal(/\bDROP\b|\bRENAME\b|\bALTER\b/.test(sql), false);
    assert.equal(sql.includes("emailVerified"), false);
    assert.equal(sql.includes('"emailVerified"'), false);
  });
});

describe("db:migrate guard", () => {
  test("DB_MIGRATIONS=disabled refuses migrate without calling drizzle-kit", () => {
    let stderr = "";
    try {
      execFileSync("node", ["scripts/drizzle-kit.mjs", "migrate"], {
        cwd: root,
        env: { ...process.env, DB_MIGRATIONS: "disabled" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      assert.fail("migrate should have exited");
    } catch (error) {
      const err = error as { status?: number; stderr?: string };
      stderr = err.stderr ?? "";
      assert.equal(err.status, 1);
    }
    assert.match(stderr, /DB_MIGRATIONS=disabled/);
    assert.equal(stderr.includes("api.cloudflare.com"), false);
  });
});
