# Duekeep

**Ailurid** — completion-anchored chore/routine cadence.

Last done + cadence → what’s due (optional calendar holds). Not a habit RPG. Not another task manager.

## Stack

- TypeScript (strict)
- Temporal (`@js-temporal/polyfill`; native on Node 26+)
- Next.js (App Router)
- React
- Tailwind CSS
- Vitest / ESLint / Prettier
- Drizzle + SQLite (libsql) — catalog + completions schema, migrations, mappers
- Deploy target: Vercel

## Status

Pre-v1. Domain schemas (`src/domain`), pure due-engine (`src/engine`), local SQLite persistence (`src/db`), and app adapters (`src/adapters`: load catalog → evaluate → due-list view models) are in place. Mark-done UI comes later.

Product brief lives in Notion. Engine before chrome; dogfood on real chores before any storefront.

## Non-goals (v1)

Gamification, social, full GTD, AI coaching chat, accounts-heavy SaaS.

## Setup

```bash
git clone git@github.com:arieljbirnbaum/duekeep.git
cd duekeep
pnpm install   # packageManager is pnpm@12.6.0
pnpm db:migrate   # apply drizzle/ SQL to local SQLite (file:./duekeep.db or DATABASE_URL)
pnpm typecheck && pnpm lint && pnpm test
```

`DATABASE_URL` defaults to `file:./duekeep.db` when unset (see `drizzle.config.ts`).

## Architecture

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for layering, engine purity rules, time-zone assumptions (`Temporal.Instant` + required IANA `zone` on items; adapters supply zone + `horizonDays`; `@js-temporal/polyfill` for Node 20/22), and the PR checklist.

Short contributor notes: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

## Scripts

| Script             | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `pnpm dev`         | Next.js dev server                       |
| `pnpm build`       | Production build                         |
| `pnpm lint`        | ESLint                                   |
| `pnpm typecheck`   | `tsc --noEmit` (strict)                  |
| `pnpm test`        | Vitest — engine + db + adapter tests     |
| `pnpm test:watch`  | Vitest watch mode                        |
| `pnpm format`      | Prettier write                           |
| `pnpm db:generate` | Drizzle kit generate → `./drizzle`       |
| `pnpm db:migrate`  | Apply migrations (`drizzle-kit migrate`) |
| `pnpm db:studio`   | Drizzle Studio                           |

## Database

Local SQLite via libsql + Drizzle. Schema and Instant/ISO + required-zone policy: **[ARCHITECTURE.md](./ARCHITECTURE.md)** (DB layer).

```bash
pnpm db:generate   # after schema changes
pnpm db:migrate    # from a clean clone / after pulling new migrations
```

Mappers live in `src/db/mappers.ts` (not in the engine). Never store `DueState` in SQL.

## Key paths

```
src/domain/     Zod schemas + constrained types + fail-loud parsers
src/engine/     pure due-engine (evaluate; typedefs from domain; no Temporal.Now / Drizzle / Zod parse)
src/adapters/   load catalog → evaluate → due-list VMs; UX defaults (horizon, zone)
src/time/       edge clocks (systemClock) — inject into adapters/UI
src/db/         Drizzle schema, mappers (domain parsers), migrate helper (no due math)
drizzle/        committed SQL migrations
src/app/        Next.js UI shell
ARCHITECTURE.md layering & contract
CONTRIBUTING.md setup & PR expectations
```
