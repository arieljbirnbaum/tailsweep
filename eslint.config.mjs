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

/**
 * Ariel soundness: blanket-forbid type assertions; only documented allowlist
 * escapes. `as unknown` is never a stepping stone — chained assertions banned.
 *
 * Allowlist (typeAnnotation shapes in typescript-eslint AST):
 * - `as const` / `<const>` → TSTypeReference typeName "const"
 * - `as unknown` / `<unknown>` → TSUnknownKeyword
 * - `as Error` → TSTypeReference typeName "Error"
 * - `as Record<…>` → TSTypeReference typeName "Record"
 */
const typeAssertionBanMessage =
  "Type assertions (`as Type` / `<Type>`) are banned except the documented allowlist: `as const`, `as Record<…>`, `as Error`, `as unknown`. Prefer valid-by-construction parsers, `in`/instanceof narrowing, or rewrite types. See ARCHITECTURE.md.";

const typeAssertionChainBanMessage =
  "Chained type assertions (e.g. `x as unknown as Cadence`) are banned. `as unknown` is a justified untyped edge only — never a forge/stepping-stone to another type.";

/** Match assertions whose typeAnnotation is NOT one of the four allowlisted forms. */
const notAllowlistedAssertion =
  ":not([typeAnnotation.typeName.name='const'])" +
  ":not([typeAnnotation.type='TSUnknownKeyword'])" +
  ":not([typeAnnotation.typeName.name='Error'])" +
  ":not([typeAnnotation.typeName.name='Record'])";

const typeAssertionRestrictedSyntax = [
  {
    selector: `TSAsExpression${notAllowlistedAssertion}`,
    message: typeAssertionBanMessage,
  },
  {
    selector: `TSTypeAssertion${notAllowlistedAssertion}`,
    message: typeAssertionBanMessage,
  },
  {
    selector:
      "TSAsExpression[expression.type=/^(TSAsExpression|TSTypeAssertion)$/]",
    message: typeAssertionChainBanMessage,
  },
  {
    selector:
      "TSTypeAssertion[expression.type=/^(TSAsExpression|TSTypeAssertion)$/]",
    message: typeAssertionChainBanMessage,
  },
];

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
        ...typeAssertionRestrictedSyntax,
      ],
    },
  },
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      // Flat config replaces the whole rule — keep Date + assertion bans + engine extras.
      "no-restricted-syntax": [
        "error",
        ...dateRestrictedSyntax,
        ...typeAssertionRestrictedSyntax,
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
