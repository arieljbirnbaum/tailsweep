import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const dateBanMessage =
  "Date is banned in Duekeep. Use Temporal.Instant / ZonedDateTime / PlainDate.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "drizzle/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    rules: {
      // Type-only imports must use `import type` (stricter module boundary).
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      // Prefer explicit types at engine boundaries; keep lint quiet for UI stubs.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Repo-wide Date-Verbot (prefer Temporal).
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            Date: {
              message: dateBanMessage,
            },
          },
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: dateBanMessage,
        },
        {
          selector: "CallExpression[callee.object.name='Date']",
          message: dateBanMessage,
        },
      ],
    },
  },
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: dateBanMessage,
        },
        {
          selector: "CallExpression[callee.object.name='Date']",
          message: dateBanMessage,
        },
        {
          selector:
            "MemberExpression[object.name='Temporal'][property.name='Now']",
          message:
            "Temporal.Now is banned in src/engine. Inject Clock or pass Temporal.Instant from the edge.",
        },
      ],
    },
  },
]);

export default eslintConfig;
