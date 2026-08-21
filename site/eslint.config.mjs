import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "playwright/.cache/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
    // Generated schema declarations are not hand-maintained source files.
    "app/schemas/*.d.ts",
  ]),
]);

export default eslintConfig;
