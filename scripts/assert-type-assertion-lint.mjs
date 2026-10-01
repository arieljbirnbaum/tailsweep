#!/usr/bin/env node
/**
 * Regression: stock `@typescript-eslint/consistent-type-assertions`
 * (`assertionStyle: "never"`).
 * - Skeptic forges (`as Cadence`, aliases, chains) must fail.
 * - `as const` must stay clean (always allowed by the stock rule).
 * Uses ESLint lintText + repo config.
 */
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const RULE_ID = "@typescript-eslint/consistent-type-assertions";

/** @type {{ name: string; code: string; mustFail: boolean }[]} */
const cases = [
  {
    name: "bare-cadence.ts",
    mustFail: true,
    code: `import type { Cadence } from "@/domain";
const _bad = { kind: "daily" } as Cadence;
`,
  },
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
    name: "chain-unknown-cadence.ts",
    mustFail: true,
    code: `import type { Cadence } from "@/domain";
const _bad = { kind: "daily" } as unknown as Cadence;
`,
  },
  {
    name: "as-const-ok.ts",
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
  const hits = (result?.messages ?? []).filter((m) => m.ruleId === RULE_ID);
  const didFail = hits.length > 0;
  if (c.mustFail && !didFail) {
    console.error(
      `FAIL: expected ${RULE_ID} for ${c.name}; messages=`,
      result?.messages ?? [],
    );
    failed = true;
  } else if (!c.mustFail && didFail) {
    console.error(`FAIL: expected clean lint for ${c.name}; messages=`, hits);
    failed = true;
  } else {
    console.log(`ok: ${c.name} ${c.mustFail ? "fails lint" : "stays clean"}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("type-assertion lint regression: all cases matched");
