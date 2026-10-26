#!/usr/bin/env node
/**
 * pnpm db:* entry. Loads .env then .env.local (without overriding the
 * process environment) and refuses migrate/push when DB_MIGRATIONS=disabled.
 * Does not open a database for generate or check.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file, into) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    into[key] = value;
  }
}

const fromFiles = {};
loadEnvFile(path.join(root, ".env"), fromFiles);
loadEnvFile(path.join(root, ".env.local"), fromFiles);
for (const [key, value] of Object.entries(fromFiles)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const command = process.argv[2];
if (!command) {
  console.error("Usage: node scripts/drizzle-kit.mjs <generate|migrate|push|studio|check> [args]");
  process.exit(1);
}

const mutating = command === "migrate" || command === "push";
if (mutating && process.env.DB_MIGRATIONS === "disabled") {
  console.error(
    `Refusing drizzle-kit ${command}: DB_MIGRATIONS=disabled. This app shares another app's database. Do not create or alter its tables. See .cursor/skills/drizzle-d1.`,
  );
  process.exit(1);
}

const bin = path.join(root, "node_modules", ".bin", "drizzle-kit");
const result = spawnSync(bin, [command, ...process.argv.slice(3)], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
