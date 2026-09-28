# Contributing to Duekeep

## Setup

```bash
pnpm install
pnpm db:migrate   # local SQLite schema (file:./duekeep.db or DATABASE_URL)
pnpm dev          # Next.js
pnpm test         # Vitest
pnpm typecheck
pnpm lint
```

Requires **Node ≥ 20**. Temporal comes from `@js-temporal/polyfill` (native on Node 26+).

## Where to work

| Area               | Path                                        | Owner (handoff)                               |
| ------------------ | ------------------------------------------- | --------------------------------------------- |
| Due math           | `src/engine/`                               | **Ariel** — domain; mutual review with Mercer |
| Scaffold / harness | repo root, configs, tests defining contract | Mercer (this scaffold)                        |
| UI                 | `src/app/`                                  | later                                         |
| DB                 | `src/db/`                                   | schema, mappers, migrations (no due math)     |

## Changing the engine

1. Read `ARCHITECTURE.md` (contract + time-zone rules). Calendar contract is **intent**: advance on the item’s local civil calendar in `item.zone`; `nextDue` is that day’s start-of-day Instant. Do **not** prescribe Instant→ZDT→PlainDate (or any other) call pipeline — any Temporal path that realizes the intent is fine; contract equality is `Temporal.Instant.equals` on SOD Instants.
2. Open `src/engine/evaluate.test.ts` — that table is the behavioral spec.
3. Do **not** weaken tests to get green; change tests only if the product contract changes, and update `ARCHITECTURE.md` in the same PR.
4. Prefer small pure helpers co-located under `src/engine/` — still no I/O.
5. Use `Temporal` from `src/engine/temporal.ts` (polyfill re-export). Midnight/DST: Temporal’s default disambiguation (`compatible`).

## Time zone note

Adapters/UI pass an IANA `zone` on every catalog item and `horizonDays` on every evaluate\* call. The engine has **no** default zone or horizon. Tests set `zone` explicitly on fixtures (e.g. `Europe/Berlin`). Fixtures use `Temporal.Instant.from('...')`, not `Date`.

Production “now” is injected at the edge via `src/time/system-clock.ts` (or an inline `{ now: () => Temporal.Now.instant() }`). Do not call `Temporal.Now` inside `src/engine` — ESLint fails the build. Repo-wide ESLint also bans `Date`.

## Commits

Clear, imperative subjects. Examples:

- `feat(engine): implement daily/weekly evaluateItem`
- `test(engine): add monthly edge cases for month-end`
- `docs: clarify required zone and horizonDays`
- `chore(engine): replace Date with Temporal Instant`

## PR checklist

See `ARCHITECTURE.md`.
