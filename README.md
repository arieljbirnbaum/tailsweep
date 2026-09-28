# Duekeep

**Ailurid** — completion-anchored chore/routine cadence.

Last done + cadence → what’s due (optional calendar holds). Not a habit RPG. Not another task manager.

## Stack

- TypeScript (strict)
- Next.js (App Router)
- React
- Tailwind CSS
- Vitest / ESLint / Prettier
- Drizzle + SQLite (libsql) — schema placeholders only
- Deploy target: Vercel

## Status

Pre-v1. Scaffold + **pure due-engine contract** are in place. Domain logic in `src/engine` is intentionally **not** implemented yet — see handoff below.

Product brief lives in Notion. Engine before chrome; dogfood on real chores before any storefront.

## Non-goals (v1)

Gamification, social, full GTD, AI coaching chat, accounts-heavy SaaS.

## Setup

```bash
git clone git@github.com:arieljbirnbaum/duekeep.git
cd duekeep
pnpm install   # creates pnpm-lock.yaml if missing; packageManager is pnpm@12.6.0
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm test` is **expected red** until Ariel implements `evaluateItem`.

## Architecture

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for layering, engine purity rules, time-zone assumptions (UTC instants + required IANA `zone` on items; adapters supply zone + `horizonDays`), and the PR checklist.

Short contributor notes: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest — engine contract tests |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm format` | Prettier write |
| `pnpm db:generate` | Drizzle kit generate |
| `pnpm db:studio` | Drizzle Studio |

## Handoff — Ariel

1. Implement `evaluateItem` / helpers in `src/engine` until **`pnpm test` is green**.
2. Do not put due math in `src/db` or the UI.
3. Keep the engine free of Next / React / Drizzle / `fs` / `fetch`.
4. Contract lives in `src/engine/evaluate.test.ts` + `ARCHITECTURE.md`.

Stubs throw `NotImplementedError` so the harness is honest: red tests mean “not done yet,” not “silent wrong answers.”

## Key paths

```
src/engine/     pure due-engine (types, clock, evaluate stubs, contract tests)
src/db/         Drizzle schema + libsql client (no due math)
src/app/        Next.js UI shell
ARCHITECTURE.md layering & contract
CONTRIBUTING.md setup & PR expectations
```
