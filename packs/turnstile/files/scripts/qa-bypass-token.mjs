#!/usr/bin/env node
/**
 * Mint a short-lived QA bypass token for a Turnstile-protected route.
 *
 *   QA_BYPASS_SECRET=... node scripts/qa-bypass-token.mjs <scope>
 *
 * Prints ONLY the token (valid 6h). Send it as the `x-potencia-qa-bypass` header.
 * Format must match src/lib/auth/qa-bypass-token.ts.
 */
import { createHmac, randomBytes } from "node:crypto";

const scope = process.argv[2];
if (!scope || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(scope)) {
  console.error("usage: node scripts/qa-bypass-token.mjs <scope>   (e.g. password-reset, sign-up)");
  process.exit(2);
}
const secret = process.env.QA_BYPASS_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) {
  console.error("QA_BYPASS_SECRET must be set (>= 32 bytes)");
  process.exit(2);
}
const issuedAt = Math.floor(Date.now() / 1000);
const nonce = randomBytes(16).toString("base64url");
const sig = createHmac("sha256", secret).update(`v1.${issuedAt}.${nonce}.${scope}`).digest("hex");
process.stdout.write(`v1.${issuedAt}.${nonce}.${sig}\n`);
