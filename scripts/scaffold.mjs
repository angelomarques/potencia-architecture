#!/usr/bin/env node
/**
 * Create a Potencia app from this template + selected feature packs.
 *
 * Usage (pnpm only):
 *   pnpm create -- --name my-app
 *   pnpm scaffold -- --name my-app --with-auth --with-redis --without-cf-queues
 *   pnpm scaffold -- --name my-app --packs auth,redis,orpc --out ../my-app
 *
 * Defaults come from packs/defaults.json.
 * OFF packs never leave dead code in the destination.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { name: null, dest: null, with: new Set(), without: new Set(), packs: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name" || a === "-n") out.name = argv[++i];
    else if (a === "--out" || a === "-o") out.dest = argv[++i];
    else if (a === "--packs") out.packs = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--with-")) out.with.add(a.slice("--with-".length));
    else if (a.startsWith("--without-")) out.without.add(a.slice("--without-".length));
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function loadDefaults() {
  const p = path.join(TEMPLATE_ROOT, "packs/defaults.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listPacks() {
  const dir = path.join(TEMPLATE_ROOT, "packs");
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(dir, n, "pack.json")));
}

function resolveEnabled(args) {
  const defaults = loadDefaults();
  const all = listPacks();
  let enabled;
  if (args.packs) {
    enabled = new Set(args.packs);
  } else {
    enabled = new Set(Object.entries(defaults).filter(([, v]) => v).map(([k]) => k));
  }
  for (const p of args.with) enabled.add(p);
  for (const p of args.without) enabled.delete(p);
  for (const p of enabled) {
    if (!all.includes(p)) {
      console.error(`Unknown pack: ${p}. Available: ${all.join(", ")}`);
      process.exit(1);
    }
  }
  // Resolve dependsOn
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of [...enabled]) {
      const meta = JSON.parse(
        fs.readFileSync(path.join(TEMPLATE_ROOT, "packs", name, "pack.json"), "utf8"),
      );
      for (const dep of meta.dependsOn ?? []) {
        if (!enabled.has(dep)) {
          enabled.add(dep);
          changed = true;
          console.log(`[scaffold] enabling dependency ${dep} (required by ${name})`);
        }
      }
    }
  }
  return { enabled, all, defaults };
}

function copyDir(src, dest, { ignore = [] } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignore.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, { ignore });
    else fs.copyFileSync(s, d);
  }
}

function overlayPackFiles(packName, destRoot) {
  const filesRoot = path.join(TEMPLATE_ROOT, "packs", packName, "files");
  if (!fs.existsSync(filesRoot)) return [];
  const written = [];
  function walk(dir, rel = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = path.join(rel, entry.name);
      const src = path.join(dir, entry.name);
      const dest = path.join(destRoot, relPath);
      if (entry.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        walk(src, relPath);
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        written.push(relPath);
      }
    }
  }
  walk(filesRoot);
  return written;
}

function stripPackFiles(packName, destRoot) {
  const filesRoot = path.join(TEMPLATE_ROOT, "packs", packName, "files");
  if (!fs.existsSync(filesRoot)) return;
  function walk(dir, rel = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = path.join(rel, entry.name);
      const dest = path.join(destRoot, relPath);
      if (entry.isDirectory()) walk(srcJoin(dir, entry.name), relPath);
      else if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
  }
  function srcJoin(a, b) {
    return path.join(a, b);
  }
  walk(filesRoot);
}

function mergePackageDeps(destPkgPath, enabled) {
  const pkg = JSON.parse(fs.readFileSync(destPkgPath, "utf8"));
  pkg.dependencies = pkg.dependencies ?? {};
  pkg.devDependencies = pkg.devDependencies ?? {};
  // Start from a minimal core set, then add pack deps
  const coreDeps = {
    "@hookform/resolvers": "^5.2.0",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-slot": "^1.2.3",
    "@t3-oss/env-nextjs": "^0.13.8",
    "class-variance-authority": "^0.7.1",
    axios: "^1.20.0",
    clsx: "^2.1.1",
    "lucide-react": "^0.544.0",
    next: "^15.5.0",
    react: "^19.1.0",
    "react-dom": "^19.1.0",
    "react-hook-form": "^7.62.0",
    "tailwind-merge": "^3.3.1",
    zod: "^4.1.0",
  };
  const coreDev = {
    "@playwright/test": "^1.55.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@eslint/eslintrc": "^3.3.0",
    eslint: "^9",
    "eslint-config-next": "^15.5.0",
    tailwindcss: "^4",
    "tw-animate-css": "^1.3.8",
    typescript: "^5",
  };
  pkg.dependencies = { ...coreDeps };
  pkg.devDependencies = { ...coreDev };
  for (const name of enabled) {
    const meta = JSON.parse(
      fs.readFileSync(path.join(TEMPLATE_ROOT, "packs", name, "pack.json"), "utf8"),
    );
    Object.assign(pkg.dependencies, meta.dependencies ?? {});
    Object.assign(pkg.devDependencies, meta.devDependencies ?? {});
  }
  // Always keep zod
  pkg.dependencies.zod = pkg.dependencies.zod ?? "^4.1.0";
  if (pkg.name === "potencia-stack" && process.env.SCAFFOLD_APP_NAME) {
    pkg.name = process.env.SCAFFOLD_APP_NAME;
  }
  fs.writeFileSync(destPkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function writeEnabledManifest(destRoot, enabled, all) {
  const manifest = {
    packs: Object.fromEntries(all.map((n) => [n, enabled.has(n)])),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(destRoot, "potencia.packs.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}


/** Derive a short unique PostHog EVENT_PREFIX from an app name.
 *  kingdom-movies → km, potencia-dashboard → pd, myapp → mya
 */
function deriveEventPrefix(name) {
  const slug = String(name || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const parts = slug.split("-").filter(Boolean);
  let prefix;
  if (parts.length >= 2) {
    prefix = parts.map((p) => p[0]).join("");
  } else {
    prefix = (parts[0] || "app").slice(0, 3);
  }
  prefix = prefix.replace(/[^a-z0-9]/g, "").slice(0, 8);
  if (!/^[a-z]/.test(prefix)) prefix = `a${prefix}`;
  return prefix || "app";
}

function applyEventPrefix(destRoot, appName) {
  const prefix = deriveEventPrefix(appName);
  const envExample = path.join(destRoot, ".env.example");
  if (fs.existsSync(envExample)) {
    let envText = fs.readFileSync(envExample, "utf8");
    if (/^NEXT_PUBLIC_EVENT_PREFIX=.*/m.test(envText)) {
      envText = envText.replace(
        /^NEXT_PUBLIC_EVENT_PREFIX=.*/m,
        `NEXT_PUBLIC_EVENT_PREFIX=${prefix}`,
      );
    } else {
      envText += `\nNEXT_PUBLIC_EVENT_PREFIX=${prefix}\n`;
    }
    fs.writeFileSync(envExample, envText);
  }
  const packsPath = path.join(destRoot, "potencia.packs.json");
  if (fs.existsSync(packsPath)) {
    const manifest = JSON.parse(fs.readFileSync(packsPath, "utf8"));
    manifest.eventPrefix = prefix;
    fs.writeFileSync(packsPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`[scaffold] NEXT_PUBLIC_EVENT_PREFIX=${prefix} (from name "${appName}")`);
  return prefix;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.name) {
    console.log(`Usage: pnpm scaffold -- --name <app> [options]

Options:
  --name, -n          App / folder name (required)
  --out, -o           Destination directory (default: ../<name>)
  --packs a,b,c       Explicit pack list (overrides defaults)
  --with-<pack>       Force-enable a pack
  --without-<pack>    Force-disable a pack

Defaults: see packs/defaults.json
Available packs: ${listPacks().join(", ")}
`);
    process.exit(args.help ? 0 : 1);
  }

  const dest = path.resolve(args.dest ?? path.join(TEMPLATE_ROOT, "..", args.name));
  if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
    console.error(`Destination not empty: ${dest}`);
    process.exit(1);
  }

  const { enabled, all } = resolveEnabled(args);
  console.log("[scaffold] destination:", dest);
  console.log("[scaffold] enabled packs:", [...enabled].sort().join(", ") || "(none)");
  console.log(
    "[scaffold] disabled packs:",
    all.filter((p) => !enabled.has(p)).join(", ") || "(none)",
  );

  // Copy template core (exclude packs overlays source, node_modules, git, tmp)
  copyDir(TEMPLATE_ROOT, dest, {
    ignore: [
      ".git",
      "node_modules",
      ".next",
      ".vercel",
      ".tmp-scaffold",
      "pnpm-lock.yaml", // regenerate for selected deps
      "artifacts",
    ],
  });

  // Remove any previously-baked pack files that are disabled
  for (const pack of all) {
    if (!enabled.has(pack)) stripPackFiles(pack, dest);
  }
  // Overlay enabled packs (idempotent)
  for (const pack of enabled) {
    const files = overlayPackFiles(pack, dest);
    console.log(`[scaffold] pack ${pack}: ${files.length} files`);
  }

  process.env.SCAFFOLD_APP_NAME = args.name;
  mergePackageDeps(path.join(dest, "package.json"), enabled);
  const pkg = JSON.parse(fs.readFileSync(path.join(dest, "package.json"), "utf8"));
  pkg.name = args.name;
  fs.writeFileSync(path.join(dest, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  writeEnabledManifest(dest, enabled, all);
  applyEventPrefix(dest, args.name);

  // The Drizzle example procedure needs auth + d1. The base router does not.
  if (enabled.has("orpc") && !(enabled.has("d1") && enabled.has("auth"))) {
    const baseRouter = path.join(TEMPLATE_ROOT, "packs/orpc/router.base.ts");
    const destRouter = path.join(dest, "src/lib/orpc/router.ts");
    if (fs.existsSync(baseRouter) && fs.existsSync(destRouter)) {
      fs.copyFileSync(baseRouter, destRouter);
      console.log("[scaffold] orpc router without Drizzle example (needs auth + d1)");
    }
  }

  if (!enabled.has("d1")) {
    const pkgPath = path.join(dest, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    for (const script of ["db:generate", "db:migrate", "db:push", "db:studio", "db:check", "test:db"]) {
      delete pkg.scripts[script];
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }

  // Drop template-only scaffold docs noise? keep packs/ so apps can re-enable later.
  console.log("[scaffold] next: cd", dest, "&& pnpm install && pnpm dev");
  console.log("[scaffold] DONE");
}

main();
