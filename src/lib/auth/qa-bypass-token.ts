import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * QA bypass tokens (pure helpers — no env, no I/O).
 *
 * Format: v1.<issuedAtUnixSeconds>.<nonce>.<hex hmacSha256(secret, "v1."+issuedAt+"."+nonce+"."+scope)>
 * Valid for 6h from issuedAt; rejected if issuedAt is >2 min in the future.
 * Keep in sync with scripts/qa-bypass-token.mjs.
 */
export const QA_BYPASS_HEADER = "x-potencia-qa-bypass";
export const QA_BYPASS_VERSION = "v1";
export const QA_BYPASS_TTL_SECONDS = 6 * 60 * 60;
export const QA_BYPASS_MAX_SKEW_SECONDS = 2 * 60;
export const QA_BYPASS_MIN_SECRET_LENGTH = 32;

export type QaBypassVerifyFailure =
  | "disabled"
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "future";

export type QaBypassVerifyResult =
  | { ok: true; issuedAt: number }
  | { ok: false; reason: QaBypassVerifyFailure };

const TOKEN_RE = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{16,128})\.([0-9a-f]{64})$/;
const SCOPE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function sign(secret: string, issuedAt: number, nonce: string, scope: string): string {
  return createHmac("sha256", secret)
    .update(`${QA_BYPASS_VERSION}.${issuedAt}.${nonce}.${scope}`)
    .digest("hex");
}

export function isQaBypassSecretUsable(secret: string | undefined | null): secret is string {
  return typeof secret === "string" && Buffer.byteLength(secret) >= QA_BYPASS_MIN_SECRET_LENGTH;
}

export function mintQaBypassToken(opts: {
  secret: string;
  scope: string;
  nowSeconds?: number;
  nonce?: string;
}): string {
  if (!isQaBypassSecretUsable(opts.secret)) throw new Error("QA bypass secret too short");
  if (!SCOPE_RE.test(opts.scope)) throw new Error("Invalid QA bypass scope");
  const issuedAt = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const nonce = opts.nonce ?? randomBytes(16).toString("base64url");
  return `${QA_BYPASS_VERSION}.${issuedAt}.${nonce}.${sign(opts.secret, issuedAt, nonce, opts.scope)}`;
}

export function verifyQaBypassToken(opts: {
  token: string | null | undefined;
  scope: string;
  secret: string | undefined | null;
  nowSeconds?: number;
}): QaBypassVerifyResult {
  if (!isQaBypassSecretUsable(opts.secret)) return { ok: false, reason: "disabled" };
  if (!opts.token) return { ok: false, reason: "missing" };
  const m = TOKEN_RE.exec(opts.token.trim());
  if (!m || !SCOPE_RE.test(opts.scope)) return { ok: false, reason: "malformed" };
  const issuedAt = Number(m[1]);
  const nonce = m[2];
  const expected = Buffer.from(sign(opts.secret, issuedAt, nonce, opts.scope), "hex");
  const given = Buffer.from(m[3], "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (issuedAt > now + QA_BYPASS_MAX_SKEW_SECONDS) return { ok: false, reason: "future" };
  if (now - issuedAt > QA_BYPASS_TTL_SECONDS) return { ok: false, reason: "expired" };
  return { ok: true, issuedAt };
}
