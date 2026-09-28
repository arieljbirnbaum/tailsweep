# Contributing to Duekeep

## Setup

```bash
pnpm install
pnpm dev          # Next.js
pnpm test         # Vitest (engine contract — expect red until evaluate* is implemented)
pnpm typecheck
pnpm lint
```

Requires **Node ≥ 20**. Temporal comes from `@js-temporal/polyfill` (native on Node 26+).

## Where to work

| Area | Path | Owner (handoff) |
|------|------|-----------------|
| Due math | `src/engine/` | **Ariel** — implement until `pnpm test` is green |
| Scaffold / harness | repo root, configs, tests defining contract | Mercer (this scaffold) |
| UI | `src/app/` | later |
| DB | `src/db/` | schema placeholder only for now |

## Implementing the engine

1. Read `ARCHITECTURE.md` (contract + time-zone rules).
2. Open `src/engine/evaluate.test.ts` — that table is the spec.
3. Replace the `NotImplementedError` in `evaluateItem` (and keep `evaluateCatalog` as a pure map unless you need shared helpers).
4. Do **not** weaken tests to get green; change tests only if the product contract changes, and update `ARCHITECTURE.md` in the same PR.
5. Prefer small pure helpers co-located under `src/engine/` (e.g. `calendar.ts`) — still no I/O.
6. Use `Temporal` from `src/engine/temporal.ts` (polyfill re-export). Calendar math: Instant → ZonedDateTimeISO(`item.zone`) → PlainDate → add → start-of-day Instant (`disambiguation: "compatible"`).

## Time zone note

Adapters/UI pass an IANA `zone` on every catalog item and `horizonDays` on every evaluate\* call. The engine has **no** default zone or horizon. Tests set `zone` explicitly on fixtures (e.g. `Europe/Berlin`). Fixtures use `Temporal.Instant.from('...')`, not `Date`.

## Commits

Clear, imperative subjects. Examples:

- `feat(engine): implement daily/weekly evaluateItem`
- `test(engine): add monthly edge cases for month-end`
- `docs: clarify required zone and horizonDays`
- `chore(engine): replace Date with Temporal Instant`

## PR checklist

See `ARCHITECTURE.md`.
