#!/usr/bin/env node
/**
 * Regression: brand-assertion lint must fail the three Skeptic alias bypasses
 * (renamed import, type Alias = Cadence, import().Cadence) and still allow
 * `as const` / non-literal `value as Error`. Uses ESLint lintText + repo config.
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
    name: "as-const-ok.ts",
    mustFail: false,
    code: `const _ok = { kind: "daily" } as const;
const raw: unknown = {};
const _err = raw as Error;
const _rec = raw as Record<string, unknown>;
const _unk = raw as unknown;
`,
  },
];

const eslint = new ESLint({ cwd: repoRoot });
let failed = false;

for (const c of cases) {
  // filePath under src/ so flat-config file globs + parser apply.
  const filePath = join(repoRoot, "src", "engine", `__brand-lint-probe__${c.name}`);
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
console.log("brand-assertion lint regression: all cases matched");
