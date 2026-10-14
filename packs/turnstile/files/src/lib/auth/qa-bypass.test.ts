import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { beforeEach, describe, test } from "node:test";

import { checkQaBypass, resetQaBypassRateLimit } from "./qa-bypass";
import {
  QA_BYPASS_HEADER,
  QA_BYPASS_MAX_SKEW_SECONDS,
  QA_BYPASS_TTL_SECONDS,
  mintQaBypassToken,
  verifyQaBypassToken,
} from "./qa-bypass-token";
import { verifyTurnstileOrQaBypass } from "./turnstile";

// Test-only secret, never used anywhere real.
const SECRET = "test-secret-".padEnd(64, "x");
const NOW = 1_800_000_000;
const silent = () => {};

function headersWith(token?: string) {
  const h = new Headers();
  if (token) h.set(QA_BYPASS_HEADER, token);
  return h;
}

describe("verifyQaBypassToken", () => {
  test("valid token for the right scope", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    assert.deepEqual(verifyQaBypassToken({ token, scope: "sign-up", secret: SECRET, nowSeconds: NOW + 60 }), {
      ok: true,
      issuedAt: NOW,
    });
  });

  test("expired after 6h", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    const r = verifyQaBypassToken({ token, scope: "sign-up", secret: SECRET, nowSeconds: NOW + QA_BYPASS_TTL_SECONDS + 1 });
    assert.deepEqual(r, { ok: false, reason: "expired" });
    assert.equal(
      verifyQaBypassToken({ token, scope: "sign-up", secret: SECRET, nowSeconds: NOW + QA_BYPASS_TTL_SECONDS }).ok,
      true,
    );
  });

  test("future issuedAt rejected beyond 2 min skew", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW + QA_BYPASS_MAX_SKEW_SECONDS + 1 });
    assert.deepEqual(verifyQaBypassToken({ token, scope: "sign-up", secret: SECRET, nowSeconds: NOW }), {
      ok: false,
      reason: "future",
    });
    const skewOk = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW + QA_BYPASS_MAX_SKEW_SECONDS });
    assert.equal(verifyQaBypassToken({ token: skewOk, scope: "sign-up", secret: SECRET, nowSeconds: NOW }).ok, true);
  });

  test("wrong scope rejected", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    assert.deepEqual(verifyQaBypassToken({ token, scope: "password-reset", secret: SECRET, nowSeconds: NOW }), {
      ok: false,
      reason: "bad_signature",
    });
  });

  test("tampered token rejected (issuedAt, nonce, signature, other secret)", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    const [v, iat, nonce, sig] = token.split(".");
    const variants = [
      `${v}.${Number(iat) + 1}.${nonce}.${sig}`,
      `${v}.${iat}.${nonce.slice(0, -1)}${nonce.endsWith("A") ? "B" : "A"}.${sig}`,
      `${v}.${iat}.${nonce}.${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`,
      mintQaBypassToken({ secret: "another-secret-".padEnd(64, "y"), scope: "sign-up", nowSeconds: NOW }),
    ];
    for (const t of variants) {
      assert.equal(verifyQaBypassToken({ token: t, scope: "sign-up", secret: SECRET, nowSeconds: NOW }).ok, false, t);
    }
    for (const t of ["", "v2" + token.slice(2), "garbage", `${token}.extra`]) {
      assert.equal(verifyQaBypassToken({ token: t, scope: "sign-up", secret: SECRET, nowSeconds: NOW }).ok, false);
    }
  });

  test("disabled when secret unset or too short", () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    for (const secret of [undefined, null, "", "short"]) {
      assert.deepEqual(verifyQaBypassToken({ token, scope: "sign-up", secret, nowSeconds: NOW }), {
        ok: false,
        reason: "disabled",
      });
    }
  });

  test("mint script output verifies", () => {
    const out = execFileSync("node", ["scripts/qa-bypass-token.mjs", "sign-up"], {
      env: { ...process.env, QA_BYPASS_SECRET: SECRET },
      encoding: "utf8",
    }).trim();
    assert.equal(verifyQaBypassToken({ token: out, scope: "sign-up", secret: SECRET }).ok, true);
    assert.equal(verifyQaBypassToken({ token: out, scope: "password-reset", secret: SECRET }).ok, false);
  });
});

describe("checkQaBypass / verifyTurnstileOrQaBypass", () => {
  beforeEach(() => resetQaBypassRateLimit());

  test("valid header skips siteverify and logs without the token", async () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    const lines: string[] = [];
    let siteverifyCalls = 0;
    const ok = await verifyTurnstileOrQaBypass(
      { headers: headersWith(token), scope: "sign-up", token: "", ip: "203.0.113.5" },
      {
        secret: SECRET,
        nowSeconds: NOW,
        log: (l) => lines.push(l),
        verifyTurnstile: async () => {
          siteverifyCalls++;
          return false;
        },
      },
    );
    assert.equal(ok, true);
    assert.equal(siteverifyCalls, 0);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[qa-bypass\] used route=sign-up ip=203\.0\.113\.5 issuedAt=1800000000$/);
    assert.ok(!lines.join("\n").includes(token.split(".")[3]));
  });

  test("Turnstile still enforced without the header", async () => {
    let siteverifyCalls = 0;
    const ok = await verifyTurnstileOrQaBypass(
      { headers: headersWith(), scope: "sign-up", token: "bad-turnstile", ip: "203.0.113.6" },
      {
        secret: SECRET,
        log: silent,
        verifyTurnstile: async (t) => {
          siteverifyCalls++;
          return t === "good-turnstile";
        },
      },
    );
    assert.equal(ok, false);
    assert.equal(siteverifyCalls, 1);
  });

  test("invalid header falls back to Turnstile (fail closed)", async () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "password-reset", nowSeconds: NOW });
    const ok = await verifyTurnstileOrQaBypass(
      { headers: headersWith(token), scope: "sign-up", token: "x", ip: "203.0.113.7" },
      { secret: SECRET, nowSeconds: NOW, log: silent, verifyTurnstile: async () => false },
    );
    assert.equal(ok, false);
  });

  test("bypass disabled when QA_BYPASS_SECRET unset", async () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    const ok = await checkQaBypass(
      { headers: headersWith(token), scope: "sign-up", ip: "203.0.113.8" },
      { secret: undefined, nowSeconds: NOW, log: silent },
    );
    assert.equal(ok, false);
  });

  test("bypass rate limited to 20/hour per IP", async () => {
    const token = mintQaBypassToken({ secret: SECRET, scope: "sign-up", nowSeconds: NOW });
    const results: boolean[] = [];
    for (let i = 0; i < 21; i++) {
      results.push(
        await checkQaBypass(
          { headers: headersWith(token), scope: "sign-up", ip: "203.0.113.9" },
          { secret: SECRET, nowSeconds: NOW, log: silent },
        ),
      );
    }
    assert.equal(results.filter(Boolean).length, 20);
    assert.equal(results[20], false);
    assert.equal(
      await checkQaBypass(
        { headers: headersWith(token), scope: "sign-up", ip: "198.51.100.1" },
        { secret: SECRET, nowSeconds: NOW, log: silent },
      ),
      true,
    );
  });
});
