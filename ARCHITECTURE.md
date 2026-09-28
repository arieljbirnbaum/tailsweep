# Duekeep architecture

**Ailurid** — completion-anchored chore/routine cadence. Last done + cadence → what’s due.

Engine before chrome. Debuggability first.

## Layering

```
┌─────────────────────────────────────────┐
│  UI  (src/app)  Next.js App Router      │  presentation only
├─────────────────────────────────────────┤
│  Adapters / DB  (src/db)  Drizzle+SQLite│  persist facts, map rows ↔ domain
├─────────────────────────────────────────┤
│  Engine  (src/engine)  PURE TypeScript  │  due math, types, clock, errors
└─────────────────────────────────────────┘
```

Dependencies point **inward only**:

- `src/app` may import `@/engine` and `@/db`
- `src/db` may import `@/engine` types (for mappers) — **never** the other way
- `src/engine` must **never** import Next, React, Drizzle, `fs`, `fetch`, Node I/O, or anything under `src/app` / `src/db`

If you need “today” inside the engine, take a `Temporal.Instant` argument or an injectable `Clock`. Do **not** call `Temporal.Now` anywhere under `src/engine` (ESLint error). Production clock lives at `src/time/system-clock.ts` (or inline `{ now: () => Temporal.Now.instant() }` at the adapter edge).

## Due-engine contract (`src/engine`)

### Types

| Concept | Notes |
|--------|--------|
| `Cadence` | `daily` / `weekly` / `monthly` / `quarterly` / `yearly` / `as_needed` / `{ kind: "every_n_days", days: N }` |
| `CatalogItem` | `id`, `name`, `cadence`, `lastDone: Temporal.Instant \| null`, required `zone` (IANA id), `status: active\|paused` |
| `DueState` | `due` \| `overdue` \| `upcoming` \| `not_applicable` |
| `EvaluateOptions` | required `horizonDays: number` (no engine default; no `timeZone`) |
| `Clock` | `{ now(): Temporal.Instant }` — inject at edges; `fixedClock` in tests; production `systemClock` at `src/time/system-clock.ts` (outside engine) |

### Functions

- `evaluateItem(item, now, options)` → `EvaluatedItem`
- `evaluateCatalog(items, now, options)` → `EvaluatedItem[]` (same order as input)

Behavioral rules live in `src/engine/contract-rules.ts` (IDs). `evaluate.test.ts` cases each declare `covers: [...]`; a meta-test fails if any `enforced: "test"` rule is uncovered (**contract** coverage, not line coverage). When you change state/cadence/`nextDue` rules, update both the rule registry and a table row.

### Time & time zones

- Facts are **`Temporal.Instant`** (UTC) plus a required IANA **`item.zone`** string. No `Date` anywhere in the project (ESLint `@typescript-eslint/no-restricted-types` + `no-restricted-syntax` — use Temporal).
- **`Temporal.Now` is banned under `src/engine/**`** (ESLint). Inject `Clock` or pass `Temporal.Instant` from the edge (`src/time/system-clock.ts`).
- **Calendar day boundaries** use **only** `item.zone`: Instant → `ZonedDateTimeISO(item.zone)` → `PlainDate` → add cadence → start-of-day Instant in that zone. No `options.timeZone`, no `"UTC"` default in evaluate\*.
- **`nextDue`**: Instant at **start of the local due day** in `item.zone`. When converting a PlainDate (or local midnight) to Instant across DST gaps/folds, use Temporal’s **`disambiguation: "compatible"`** (Temporal’s common default — name it explicitly in implementer code). Do not invent silent half-hour offsets.
- UX/adapters supply `zone` on each catalog item and `horizonDays` on every evaluate\* call. The engine requires both; it does not pick a dogfood default.
- `horizonDays` (required): how far ahead “upcoming” extends; beyond horizon → `not_applicable`.
- Invalid Instant / zone strings: let Temporal construction throw (`TypeError` / `RangeError`). Adapters own validation — the engine does **not** expose `assertDate` / `InvalidDateError`.

### Temporal polyfill & runtime

- Engine imports `{ Temporal }` from `src/engine/temporal.ts`, which re-exports `@js-temporal/polyfill` (does **not** patch `globalThis`).
- **Node 26+** has native Temporal; the polyfill is the portability layer for **Node 20/22** and browsers without Temporal. `package.json` engines: `"node": ">=20"`. Safari is not a design constraint.

### tzdata & local-date indexing

- Persist facts as UTC Instant strings (`lastDone`, completions) plus the IANA zone id on the catalog item.
- Due state and `nextDue` are **derived at evaluate time**, not durable source of truth. Do not store due local dates as authoritative indexes in v1.
- Calendar/.ics export is a **snapshot** under the tzdata rules of the runtime that generated it.
- Runtime tzdata comes from the host / polyfill (Node/V8 ICU or browser); the engine does not ship its own tzdb in v1. Node vs browser can diverge — dogfood/tests should pin Node version when asserting civil dates near political transitions.
- On IANA/tzdata rule changes: re-running evaluate\* may change local calendar day / start-of-day Instant for the same UTC Instant. That is accepted; do not rewrite historical completion instants. If a future feature indexes by local date, treat that index as a **cache** keyed by `(instant, zoneId, tzdataVersion)` or rebuild on tzdata bump — out of scope for v1.
- DST gaps/folds: Temporal disambiguation (`compatible` by default) is the policy; lock behavior in tests.

### State rules (completion-anchored)

1. `paused` → `not_applicable` (`nextDue` null).
2. `as_needed` + `lastDone` set → `not_applicable`; never done → `due`.
3. Scheduled cadence, never done → `overdue`.
4. Else `nextDueLocalDate = lastDoneLocalDate + cadence` (calendar add in zone).
5. Compare to “today” in zone:
   - next < today → `overdue`
   - next === today → `due`
   - today < next ≤ today+horizon → `upcoming`
   - next > today+horizon → `not_applicable`

Cadence increments (from lastDone’s local date):

- daily → +1 day; weekly → +7 days; monthly → +1 calendar month; quarterly → +3 months; yearly → +1 year; `every_n_days` → +N days.

## Debuggability

- **Injectable clock** — no `Temporal.Now` / system time in `src/engine` (lint-enforced); production clock at `src/time/system-clock.ts`.
- **Typed errors** — `NotImplementedError`, `InvalidCadenceError` (codes on `.code`). Temporal construction errors surface as-is.
- **Table-driven tests** — one row per behavior; failures name the case.
- **No silent Instant coercion** — bad strings throw from Temporal; adapters validate at the edge.

## DB layer (`src/db`)

- Stores **facts**: catalog rows + append-only `completions`.
- `cadence_json` / `last_done_at` are persistence shapes; map to/from engine types in adapters (`last_done_at` ISO Instant string ↔ `Temporal.Instant`).
- **Never** compute `DueState` in SQL or Drizzle queries.

## Naming conventions

- Engine: `camelCase` functions, `PascalCase` types, `snake_case` only inside cadence kind strings that are domain vocabulary (`as_needed`, `every_n_days`).
- DB columns: `snake_case`.
- Files: `evaluate.ts`, `evaluate.test.ts` co-located with the unit under test.
- Prefer `CatalogItem` (domain) vs `CatalogItemRow` (DB).

## PR checklist

- [ ] Engine still has **zero** Next/React/Drizzle/fs/fetch imports (`rg` the folder).
- [ ] New due behavior: add/adjust a `contract-rules.ts` id and a table row with `covers` (meta-test must stay green).
- [ ] `pnpm typecheck` && `pnpm lint` && `pnpm test` (tests green once engine is implemented).
- [ ] Times are `Temporal.Instant`; every `CatalogItem` has required `zone`; every evaluate\* call passes `horizonDays`.
- [ ] Lint enforces **no `Date`** (repo-wide) and **no `Temporal.Now`** under `src/engine/**`; production clock stays outside the engine (`src/time/system-clock.ts`).
- [ ] No due math added to `src/db`.
- [ ] README / ARCHITECTURE updated if the contract changed.
