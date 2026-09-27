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

If you need “today” inside the engine, take a `Date` argument or an injectable `Clock`. Do not call `new Date()` for business “now” inside evaluate\*.

## Due-engine contract (`src/engine`)

### Types

| Concept | Notes |
|--------|--------|
| `Cadence` | `daily` / `weekly` / `monthly` / `quarterly` / `yearly` / `as_needed` / `{ kind: "every_n_days", days: N }` |
| `CatalogItem` | `id`, `name`, `cadence`, `lastDone`, optional `zone`, `status: active\|paused` |
| `DueState` | `due` \| `overdue` \| `upcoming` \| `not_applicable` |
| `Clock` | `{ now(): Date }` — inject at edges; use `fixedClock` in tests |

### Functions (Ariel implements)

- `evaluateItem(item, now, options?)` → `EvaluatedItem`
- `evaluateCatalog(items, now, options?)` → `EvaluatedItem[]` (same order as input)

Stubs throw `NotImplementedError`. Contract tests in `evaluate.test.ts` define expected states — **make those green**.

### Time & time zones

- `now` and `lastDone` are **UTC instants** (`Date`). No silent coercion of strings/numbers — use `assertDate` / `InvalidDateError`.
- **Calendar day boundaries** use an IANA zone: `item.zone ?? options.timeZone ?? "UTC"`.
- Dogfood assumption for Ariel (Europe/Berlin): pass `timeZone: "Europe/Berlin"` (or set `item.zone`) at the adapter boundary. The engine default remains `"UTC"` so pure unit tests stay explicit.
- `horizonDays` (default **7**): how far ahead “upcoming” extends; beyond horizon → `not_applicable`.

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

- **Injectable clock** — no hidden `Date.now()` in evaluate\*.
- **Typed errors** — `NotImplementedError`, `InvalidDateError`, `InvalidCadenceError` (codes on `.code`).
- **Table-driven tests** — one row per behavior; failures name the case.
- **No silent date coercion** — invalid dates throw.

## DB layer (`src/db`)

- Stores **facts**: catalog rows + append-only `completions`.
- `cadence_json` / `last_done_at` are persistence shapes; map to/from engine types in adapters.
- **Never** compute `DueState` in SQL or Drizzle queries.

## Naming conventions

- Engine: `camelCase` functions, `PascalCase` types, `snake_case` only inside cadence kind strings that are domain vocabulary (`as_needed`, `every_n_days`).
- DB columns: `snake_case`.
- Files: `evaluate.ts`, `evaluate.test.ts` co-located with the unit under test.
- Prefer `CatalogItem` (domain) vs `CatalogItemRow` (DB).

## PR checklist

- [ ] Engine still has **zero** Next/React/Drizzle/fs/fetch imports (`rg` the folder).
- [ ] New due behavior covered by a table row in `evaluate.test.ts`.
- [ ] `pnpm typecheck` && `pnpm lint` && `pnpm test` (tests green once engine is implemented).
- [ ] Dates are `Date` instants; zone choice documented at call site.
- [ ] No due math added to `src/db`.
- [ ] README / ARCHITECTURE updated if the contract changed.
