import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next@15 ships legacy (eslintrc) configs — load them via FlatCompat.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const fetchMessage =
  "Use axios via @/lib/http (`http` for external APIs, `api` for internal routes). See .cursor/rules/http-axios.mdc.";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}", "packs/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: fetchMessage }],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: fetchMessage },
        { object: "globalThis", property: "fetch", message: fetchMessage },
        { object: "self", property: "fetch", message: fetchMessage },
      ],
    },
  },
  {
    // Allowed exceptions: the HTTP layer itself (may wrap fetch, e.g. axios fetch adapter).
    files: ["src/lib/http/**", "packs/*/files/src/lib/http/**"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
];

export default eslintConfig;
