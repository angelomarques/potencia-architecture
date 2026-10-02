#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
echo "[doctor] root=$ROOT"

fail=0
check() {
  local id="$1"; shift
  if "$@"; then echo "PASS $id"; else echo "FAIL $id"; fail=1; fi
}

check env-module test -f src/env.ts
check env-createEnv grep -q 'createEnv' src/env.ts
check env-path test "$(basename src/env.ts)" = "env.ts"
check pnpm-packageManager grep -q '"packageManager": "pnpm@' package.json
check pnpm-lock test -f pnpm-lock.yaml
check no-npm-lock test ! -f package-lock.json
check no-yarn-lock test ! -f yarn.lock
check scaffold test -f scripts/scaffold.mjs
check packs-defaults test -f packs/defaults.json
check skill-new test -f .cursor/skills/new-potencia-stack/SKILL.md
check skill-verify test -f .cursor/skills/verify-potencia-stack/SKILL.md
check health-source test -f src/app/api/health/route.ts

if grep -R --include='*.md' --include='*.mjs' --include='*.json' -n 'potencia-web' . 2>/dev/null | grep -v node_modules | grep -v '.git' | head -5; then
  echo "FAIL name-potencia-web-references"
  fail=1
else
  echo "PASS name-potencia-stack-only"
fi

exit $fail
