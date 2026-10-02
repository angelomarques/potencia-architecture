#!/usr/bin/env bash
# Overlay default-ON pack files into the template working tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node <<'NODE'
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const defaults = JSON.parse(fs.readFileSync("packs/defaults.json","utf8"));
function walk(dir, rel, destRoot) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    const s = path.join(dir, e.name);
    const d = path.join(destRoot, r);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); walk(s, r, destRoot); }
    else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(s, d); console.log("apply", r); }
  }
}
for (const [name, on] of Object.entries(defaults)) {
  if (!on) continue;
  const files = path.join(root, "packs", name, "files");
  if (fs.existsSync(files)) walk(files, "", root);
}
NODE
