import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const dateBanMessage =
  "Date is banned in Duekeep. Use Temporal.Instant / ZonedDateTime / PlainDate.";

const engineZodBanMessage =
  "Do not import zod under src/engine. Domain owns Zod parse; engine stays pure due math.";

const engineDomainValueBanMessage =
  "Do not value-import the fat @/domain barrel under src/engine. Use `import type` from @/domain, or value-import @/domain/errors only.";

const engineDbBanMessage =
  "Do not import persistence (drizzle / libsql / @/db) under src/engine. Persistence lives outside the engine.";

const brandAssertionBanMessage =
  "Do not assert `as Cadence` / `as EvaluateOptions`. Construct via domain parseCadence / parseEvaluateOptions (valid-by-construction). Type assertions reopen the brand hole.";

const objectLiteralAssertionBanMessage =
  "Do not assert an object literal with `as Type` (except `as const`). Object-literal assertions forge branded types via aliases (`as C`, `as Alias`, `as import(...).Cadence`). Construct branded values via domain parse* helpers.";

/** Ban Date construction / static calls (repo-wide). */
const dateRestrictedSyntax = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: dateBanMessage,
  },
  {
    selector: "CallExpression[callee.object.name='Date']",
    message: dateBanMessage,
  },
];

/**
 * Brand-assertion bans (repo-wide):
 * 1. Bare-name `as Cadence` / `as EvaluateOptions` (and angle-bracket form).
 * 2. Object-literal type assertions except `as const` / `<const>` —
 *    closes alias bypasses (`as C`, `as Alias`, `as import(...).Cadence`)
 *    without type-aware resolution. Legitimate non-literal casts
 *    (`value as Error`, `raw as Record<string, unknown>`, `as unknown`) stay OK.
 * `as const` is a TSTypeReference whose typeName is Identifier "const"
 * (not TSConstKeyword) in the typescript-eslint AST.
 */
const brandAssertionRestrictedSyntax = [
  {
    selector:
      "TSAsExpression[typeAnnotation.typeName.name=/^(Cadence|EvaluateOptions)$/]",
    message: brandAssertionBanMessage,
  },
  {
    selector:
      "TSTypeAssertion[typeAnnotation.typeName.name=/^(Cadence|EvaluateOptions)$/]",
    message: brandAssertionBanMessage,
  },
  {
    selector:
      "TSAsExpression[expression.type='ObjectExpression']:not([typeAnnotation.typeName.name='const'])",
    message: objectLiteralAssertionBanMessage,
  },
  {
    selector:
      "TSTypeAssertion[expression.type='ObjectExpression']:not([typeAnnotation.typeName.name='const'])",
    message: objectLiteralAssertionBanMessage,
  },
];

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
        ...dateRestrictedSyntax,
        ...brandAssertionRestrictedSyntax,
      ],
    },
  },
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      // Flat config replaces the whole rule — keep Date + brand bans + engine extras.
      "no-restricted-syntax": [
        "error",
        ...dateRestrictedSyntax,
        ...brandAssertionRestrictedSyntax,
        {
          selector: "MemberExpression[object.name='Temporal'][property.name='Now']",
          message:
            "Temporal.Now is banned in src/engine. Inject Clock or pass Temporal.Instant from the edge.",
        },
      ],
      // Engine purity import bans (was a light Vitest scan; lint catches earlier).
      // Type-only @/domain is allowed; value imports of @/domain/errors are allowed
      // (exact path match — @/domain/errors is not listed). Transitive Zod via the
      // fat barrel is blocked because value imports of @/domain are banned.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: engineZodBanMessage,
            },
            {
              name: "@/domain",
              message: engineDomainValueBanMessage,
              allowTypeImports: true,
            },
            {
              name: "@/domain/index",
              message: engineDomainValueBanMessage,
              allowTypeImports: true,
            },
            {
              name: "drizzle-orm",
              message: engineDbBanMessage,
            },
            {
              name: "@libsql/client",
              message: engineDbBanMessage,
            },
            {
              name: "@/db",
              message: engineDbBanMessage,
            },
          ],
          patterns: [
            {
              group: ["zod/*"],
              message: engineZodBanMessage,
            },
            {
              group: ["drizzle-orm/*", "@libsql/*", "@/db/*", "../db", "../db/*"],
              message: engineDbBanMessage,
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
