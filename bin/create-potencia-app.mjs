#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(process.execPath, [path.join(root, "scripts/scaffold.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
