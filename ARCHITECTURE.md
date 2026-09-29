# Duekeep architecture

**Ailurid** — completion-anchored chore/routine cadence. Last done + cadence → what’s due.

Engine before chrome. Debuggability first.

## Layering

```
┌─────────────────────────────────────────┐
│  UI  (src/app)  Next.js App Router      │  presentation only
├─────────────────────────────────────────┤
│  Adapters / DB  (src/db)  Drizzle+SQLite│  persist facts; parse at boundary
├─────────────────────────────────────────┤
│  Engine  (src/engine)  PURE TypeScript  │  due math; imports domain typedefs
├─────────────────────────────────────────┤
│  Domain  (src/domain)  Zod + types      │  schemas, constraints, fail-loud parse
└─────────────────────────────────────────┘
```

Dependencies point **inward only**:

- `src/app` may import `@/engine`, `@/db`, and `@/domain`
- `src/db` may import `@/domain` (parsers) and `@/engine` (evaluate at edges) — **never** the other way from engine/domain into db
- `src/engine` may import **types** from `@/domain` (type-only) and shared errors from `@/domain/errors` (thin, no Zod) — must **never** value-import the fat `@/domain` barrel, nor import Next, React, Drizzle, Zod for runtime parse on evaluate*, `fs`, `fetch`, Node I/O, or anything under `src/app` / `src/db`
- `src/domain` must **never** import engine evaluate logic, Drizzle, Next, or React

**Domain owns** Zod schemas + constrained types (`Cadence`, `CatalogItem`, Instant ISO helpers, zone/status). **Engine** stays pure functional due math and may depend on domain for typedefs only — do **not** run Zod on every `evaluate*` call. **Adapters/persistence** call domain `parse*` helpers at the boundary (fail-loud; no permissive coercions).

If you need “today” inside the engine, take a `Temporal.Instant` argument or an injectable `Clock`. Do **not** call `Temporal.Now` anywhere under `src/engine` (ESLint error). Production clock lives at `src/time/system-clock.ts` (or inline `{ now: () => Temporal.Now.instant() }` at the adapter edge).

## Due-engine contract (`src/engine`)

### Types

| Concept           | Notes                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cadence`         | `daily` / `weekly` / `monthly` / `quarterly` / `yearly` / `as_needed` / `{ kind: "every_n_days", days: N }`                                     |
| `CatalogItem`     | `id`, `name`, `cadence`, `lastDone: Temporal.Instant \| null`, required `zone` (IANA id), `status: active\|paused`                              |
| `DueState`        | `due` \| `overdue` \| `upcoming` \| `not_applicable`                                                                                            |
| `EvaluateOptions` | required `horizonDays: number` (no engine default; no `timeZone`)                                                                               |
| `Clock`           | `{ now(): Temporal.Instant }` — inject at edges; `fixedClock` in tests; production `systemClock` at `src/time/system-clock.ts` (outside engine) |

### Functions

- `evaluateItem(item, now, options)` → `EvaluatedItem`
- `evaluateCatalog(items, now, options)` → `EvaluatedItem[]` (same order as input)

Behavioral contract is this doc plus the table-driven cases in `evaluate.test.ts`. When you change state/cadence/`nextDue` rules, update ARCHITECTURE and a matching test row. Adversarial contract review is on-demand, not a suite meta-test.

### Time & time zones

- Facts are **`Temporal.Instant`** (UTC) plus a required IANA **`item.zone`** string. No `Date` anywhere in the project (ESLint `@typescript-eslint/no-restricted-types` + `no-restricted-syntax` — use Temporal).
- **`Temporal.Now` is banned under `src/engine/**`** (ESLint). Inject `Clock` or pass `Temporal.Instant` from the edge (`src/time/system-clock.ts`).
- **Calendar intent** (not a required call pipeline): cadence advances on the item’s **local civil calendar** in required `item.zone`. `nextDue` is the **Instant at start of that due local day** in `item.zone`. Contract equality is `Temporal.Instant.equals` on those SOD Instants. Implementations may use any Temporal path that realizes this intent (e.g. ZDT or PlainDate); do **not** treat Instant→ZDT→add→startOfDay (or PlainDate add) as the prescribed pipeline.
- **Midnight / DST**: when a local midnight is ambiguous or skipped, use Temporal’s default disambiguation **`compatible`**. Lock spring/fall SOD Instants in `evaluate.test.ts`; do not invent silent half-hour offsets. No `options.timeZone`, no `"UTC"` default in evaluate\*.
- UX/adapters supply `zone` on each catalog item and `horizonDays` on every evaluate\* call. The engine requires both; it does not pick a dogfood default.
- `horizonDays` (required): how far ahead “upcoming” extends; beyond horizon → `not_applicable`.
- Invalid Instant strings: let Temporal construction throw (`TypeError` / `RangeError`). **Zone** is validated at the domain boundary (`zoneSchema` / `parseZone`) against runtime tzdata via `Intl.supportedValuesOf("timeZone")` (Temporal fallback for ids Intl omits, e.g. `UTC`); unknown / padded zones fail loud at parse — not deferred to evaluate. Adapters own validation — the engine does **not** expose `assertDate` / `InvalidDateError`.

### Temporal polyfill & runtime

- Engine imports `{ Temporal }` from `src/engine/temporal.ts`, which re-exports `@js-temporal/polyfill` (does **not** patch `globalThis`).
- **Node 26+** has native Temporal; the polyfill is the portability layer for **Node 20/22** and browsers without Temporal. `package.json` engines: `"node": ">=20"`. Safari is not a design constraint.

### tzdata & local-date indexing

- Persist facts as UTC Instant strings (`lastDone`, completions) plus the IANA zone id on the catalog item.
- Due state and `nextDue` are **derived at evaluate time**, not durable source of truth. Do not store due local dates as authoritative indexes in v1.
- Calendar/.ics export is a **snapshot** under the tzdata rules of the runtime that generated it.
- Runtime tzdata comes from the host / polyfill (Node/V8 ICU or browser); the engine does not ship its own tzdb in v1. Node vs browser can diverge — dogfood/tests should pin Node version when asserting civil dates near political transitions.
- On IANA/tzdata rule changes: re-running evaluate\* may change local calendar day / start-of-day Instant for the same UTC Instant. That is accepted; do not rewrite historical completion instants. If a future feature indexes by local date, treat that index as a **cache** keyed by `(instant, zoneId, tzdataVersion)` or rebuild on tzdata bump — out of scope for v1.
- DST gaps/folds: Temporal’s default disambiguation (`compatible`) is the policy for local midnights; lock spring/fall SOD Instants in `evaluate.test.ts`.

### State rules (completion-anchored)

1. `paused` → `not_applicable` (`nextDue` null).
2. `as_needed` + `lastDone` set → `not_applicable` (`nextDue` null); never done → `due` (`nextDue` = start of today in `item.zone`).
3. Scheduled cadence, never done → `overdue` (`nextDue` = start of today in `item.zone`).
4. Else advance cadence on lastDone’s **local civil date** in `item.zone`; `nextDue` = Instant at **start of that due local day** in `item.zone` (midnight/DST: Temporal default `compatible`).
5. Compare next-due SOD Instant to “today” SOD Instant in zone (`Instant.equals` for same day):
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

Persistence lives **outside** `src/engine`. The engine stays pure (no Drizzle / libsql / `src/db` imports). The DB layer stores **facts** and maps rows ↔ domain types; adapters/UI call evaluate\* with those mapped `CatalogItem`s.

### What is stored

| Table           | Purpose                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog_items` | Catalog chores/routines: `id`, `name`, `cadence_json`, `last_done_at`, **required** `zone` (IANA), `status` (`active`\|`paused`), `created_at`, `updated_at` |
| `completions`   | Append-only completion log: `id`, `item_id` → catalog, `completed_at`, optional `note`                                                                       |

**Never** store `DueState` (or `nextDue`) in SQL — those are derived at evaluate time.

### Instant / ISO policy (no `Date`)

- Timestamp columns (`last_done_at`, `completed_at`, `created_at`, `updated_at`) are **ISO-8601 Instant text** (UTC), e.g. `2026-09-28T20:00:00.000Z`.
- Mappers use `Temporal.Instant.from(iso)` / `instant.toString()`. No `Date` at the schema or mapper layer (repo-wide ESLint ban).
- Bad Instant strings throw from Temporal — no silent coercion.

### Zone

- `catalog_items.zone` is **NOT NULL**, matching required `CatalogItem.zone`.
- Mappers reject empty/missing zone. **No UTC fallback** in SQL defaults or mapper code.

### Domain (`src/domain`)

- Zod schemas are the source of truth for constrained types (`Cadence`, zone, status, Instant ISO).
- `parseCadence` / `parseCadenceJson`, `parseZone`, `parseInstantIso`, `parseCatalogItemFromRow`, etc. — fail-loud at boundaries.
- Engine re-exports domain typedefs; evaluate* does not Zod-parse on the happy path.

### Mappers (`src/db/mappers.ts`)

- `rowToCatalogItem` / `catalogItemToRow` — `CatalogItemRow` ↔ `CatalogItem` via domain parsers
- `rowToCompletion` / `completionToRow` — completion facts ↔ domain
- Cadence JSON / Instant ISO / zone checks live in `@/domain` (mappers delegate)
- Convenience defaults (e.g. dogfood zone, horizon) belong in UX/adapters, **not** here or in the engine.

### Migrations

- SQL migrations in `./drizzle` (committed). Generate with `pnpm db:generate` (`drizzle-kit generate`).
- Apply with `pnpm db:migrate` (`drizzle-kit migrate`, reads `drizzle.config.ts`).
- Programmatic apply (tests): `applyMigrations(db)` from `src/db/migrate.ts` via `drizzle-orm/libsql/migrator`.
- Default DB URL: `DATABASE_URL` or `file:./duekeep.db` (see `drizzle.config.ts` / `createDb`).
- From a clean clone: `pnpm install` → `pnpm db:migrate`.

### What stays out of the DB layer

- Due math / `evaluateItem` / `DueState`
- Mark-done API / UI (later tickets)
- Seed data beyond what tests need

## Naming conventions

- Engine: `camelCase` functions, `PascalCase` types, `snake_case` only inside cadence kind strings that are domain vocabulary (`as_needed`, `every_n_days`).
- DB columns: `snake_case`.
- Files: `evaluate.ts`, `evaluate.test.ts` co-located with the unit under test.
- Prefer `CatalogItem` (domain) vs `CatalogItemRow` (DB).

## PR checklist

- [ ] Engine still has **zero** Next/React/Drizzle/fs/fetch imports (`rg` the folder); no `zod` or fat `@/domain` value import under `src/engine` (domain owns runtime parse; errors via `@/domain/errors`).
- [ ] Domain schemas remain the source of truth for Cadence / CatalogItem constraints; persistence uses domain parsers.
- [ ] New due behavior: update ARCHITECTURE state/cadence rules and add/adjust a table row in `evaluate.test.ts`.
- [ ] `pnpm typecheck` && `pnpm lint` && `pnpm test` (tests green once engine is implemented).
- [ ] Times are `Temporal.Instant`; every `CatalogItem` has required `zone`; every evaluate\* call passes `horizonDays`.
- [ ] Lint enforces **no `Date`** (repo-wide), **no `Temporal.Now`**, **no `zod`**, and **no value `@/domain` barrel** under `src/engine/**` (`@/domain/errors` + type-only `@/domain` allowed); production clock stays outside the engine (`src/time/system-clock.ts`).
- [ ] No due math added to `src/db`.
- [ ] README / ARCHITECTURE updated if the contract changed.
