#!/usr/bin/env node
/**
 * Regression: blanket type-assertion lint.
 * - Banned patterns (Cadence forges, aliases, readonly casts, literal forges,
 *   chained `as unknown as T`, formerly-allowlisted `as Record` / `as Error` /
 *   `as unknown`) must fail no-restricted-syntax.
 * - Allowlisted patterns (`as const` / `<const>` only) must stay clean —
 *   and chains involving those steps must still fail.
 * Uses ESLint lintText + repo config.
 */
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** @type {{ name: string; code: string; mustFail: boolean }[]} */
const cases = [
  {
    name: "alias-import.ts",
    mustFail: true,
    code: `import type { Cadence as C } from "@/domain";
const _bad = { kind: "daily" } as C;
`,
  },
  {
    name: "type-alias.ts",
    mustFail: true,
    code: `import type { Cadence } from "@/domain";
type Alias = Cadence;
const _bad = { kind: "daily" } as Alias;
`,
  },
  {
    name: "import-type.ts",
    mustFail: true,
    code: `const _bad = { kind: "daily" } as import("@/domain").Cadence;
`,
  },
  {
    name: "bare-cadence.ts",
    mustFail: true,
    code: `import type { Cadence } from "@/domain";
const _bad = { kind: "daily" } as Cadence;
`,
  },
  {
    name: "bare-evaluate-options.ts",
    mustFail: true,
    code: `import type { EvaluateOptions } from "@/domain";
const _bad = { horizonDays: 7 } as EvaluateOptions;
`,
  },
  {
    name: "readonly-string-array.ts",
    mustFail: true,
    code: `const kinds = ["daily"] as const;
const _bad = kinds as readonly string[];
`,
  },
  {
    name: "literal-forge.ts",
    mustFail: true,
    code: `const _bad = "archived" as "active";
`,
  },
  {
    name: "type-literal.ts",
    mustFail: true,
    code: `const err: unknown = {};
const _bad = err as { code: unknown };
`,
  },
  {
    name: "chain-unknown-cadence.ts",
    mustFail: true,
    code: `import type { Cadence } from "@/domain";
const _bad = { kind: "daily" } as unknown as Cadence;
`,
  },
  {
    name: "chain-unknown-evaluate-options.ts",
    mustFail: true,
    code: `import type { EvaluateOptions } from "@/domain";
const _bad = ({ horizonDays: 0 } as unknown) as EvaluateOptions;
`,
  },
  {
    name: "chain-unknown-error.ts",
    mustFail: true,
    code: `const raw: unknown = {};
const _bad = (raw as unknown) as Error;
`,
  },
  {
    name: "formerly-allowlisted-record.ts",
    mustFail: true,
    code: `const raw: unknown = {};
const _bad = raw as Record<string, unknown>;
`,
  },
  {
    name: "formerly-allowlisted-error.ts",
    mustFail: true,
    code: `const raw: unknown = {};
const _bad = raw as Error;
`,
  },
  {
    name: "formerly-allowlisted-unknown.ts",
    mustFail: true,
    code: `const raw: object = {};
const _bad = raw as unknown;
`,
  },
  {
    name: "allowlist-ok.ts",
    mustFail: false,
    code: `const _ok = { kind: "daily" } as const;
const _arr = ["daily"] as const;
`,
  },
];

const eslint = new ESLint({ cwd: repoRoot });
let failed = false;

for (const c of cases) {
  // filePath under src/ so flat-config file globs + parser apply.
  const filePath = join(repoRoot, "src", "engine", `__type-assert-lint-probe__${c.name}`);
  const [result] = await eslint.lintText(c.code, { filePath });
  const restricted = (result?.messages ?? []).filter(
    (m) => m.ruleId === "no-restricted-syntax",
  );
  const didFail = restricted.length > 0;
  if (c.mustFail && !didFail) {
    console.error(
      `FAIL: expected no-restricted-syntax for ${c.name}; messages=`,
      result?.messages ?? [],
    );
    failed = true;
  } else if (!c.mustFail && didFail) {
    console.error(`FAIL: expected clean lint for ${c.name}; messages=`, restricted);
    failed = true;
  } else {
    console.log(`ok: ${c.name} ${c.mustFail ? "fails lint" : "stays clean"}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("type-assertion lint regression: all cases matched");
