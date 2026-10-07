# Contributing to Duekeep

## Setup

```bash
pnpm install
pnpm db:migrate   # optional CLI migrate (file:./duekeep.db or DATABASE_URL)
pnpm dev          # Next.js; applies migrations on first DB open
pnpm test         # Vitest
pnpm typecheck
pnpm lint
```

Requires **Node ≥ 20**. Temporal comes from `@js-temporal/polyfill` (native on Node 26+).

## Where to work

| Area               | Path                                        | Owner (handoff)                              |
| ------------------ | ------------------------------------------- | -------------------------------------------- |
| Domain schemas     | `src/domain/`                               | Zod + constraints; parse at boundaries       |
| Due math           | `src/engine/`                               | **Ariel** — evaluate*; typedefs from domain  |
| App adapters       | `src/adapters/`                             | load → evaluate → VMs; UX defaults only here |
| Scaffold / harness | repo root, configs, tests defining contract | Mercer (this scaffold)                       |
| UI                 | `src/app/`                                  | bare due list; server actions mint ids       |
| DB                 | `src/db/`                                   | schema, mappers (domain parsers), migrations |

## Changing the engine / domain

1. Read `ARCHITECTURE.md` (contract + time-zone rules). Calendar contract is **intent**: advance on the item’s local civil calendar in `item.zone`; `nextDue` is that day’s start-of-day Instant. Do **not** prescribe Instant→ZDT→PlainDate (or any other) call pipeline — any Temporal path that realizes the intent is fine; contract equality is `Temporal.Instant.equals` on SOD Instants.
2. Constrained types (`Cadence`, zone, Instant ISO) live in `src/domain` (Zod). Engine imports typedefs; adapters/persistence call `parse*` at the boundary. Do **not** run Zod inside `evaluate*`.
3. Open `src/engine/evaluate.test.ts` — that table is the behavioral spec.
4. Do **not** weaken tests to get green; change tests only if the product contract changes, and update `ARCHITECTURE.md` in the same PR.
5. Prefer small pure helpers co-located under `src/engine/` — still no I/O.
6. Use `Temporal` from `src/engine/temporal.ts` (polyfill re-export). Midnight/DST: Temporal’s default disambiguation (`compatible`).

## Time zone note

Adapters/UI pass an IANA `zone` on every catalog item and `horizonDays` on every evaluate* call. The engine has **no** default zone or horizon. Dogfood defaults (`DEFAULT_HORIZON_DAYS`, `DEFAULT_ZONE`) live in `src/adapters` only. Tests set `zone` explicitly on fixtures (e.g. `Europe/Berlin`). Fixtures use `Temporal.Instant.from('...')`, not `Date`.

Production “now” is injected at the edge via `src/time/system-clock.ts` (or an inline `{ now: () => Temporal.Now.instant() }`). Do not call `Temporal.Now` inside `src/engine` — ESLint fails the build. Repo-wide ESLint also bans `Date`.

## Commits

Clear, imperative subjects. Examples:

- `feat(engine): implement daily/weekly evaluateItem`
- `test(engine): add monthly edge cases for month-end`
- `docs: clarify required zone and horizonDays`
- `chore(engine): replace Date with Temporal Instant`

## PR checklist

See `ARCHITECTURE.md`.
