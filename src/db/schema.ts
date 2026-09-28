/**
 * Drizzle schema for catalog + completions (SQLite / libsql).
 *
 * Persistence sits outside `src/engine`. Due math does NOT live here.
 * Persist facts (lastDone, cadence, zone, completions); compute DueState via
 * `src/engine` at the adapter/UI edge. Never store DueState in SQL.
 *
 * ## Instant / ISO policy (no Date)
 *
 * All timestamps are stored as **ISO-8601 Instant text** (UTC), e.g.
 * `2026-09-28T20:00:00.000Z`. Map with `Temporal.Instant.from(iso)` /
 * `instant.toString()` in `src/db/mappers.ts`. Do not use `Date` at the
 * schema or mapper layer (repo-wide ban).
 *
 * ## Zone
 *
 * `catalog_items.zone` is **NOT NULL** (IANA id). Aligns with required
 * `CatalogItem.zone` — no UTC fallback in SQL or mappers.
 */

import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Catalog chores/routines. Cadence stored as JSON text matching engine Cadence. */
export const catalogItems = sqliteTable("catalog_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** JSON-serialized Cadence from src/engine (strict-parsed in mappers). */
  cadenceJson: text("cadence_json").notNull(),
  /**
   * Last completion as ISO-8601 Instant text, or null if never done.
   * Example: `2026-09-28T10:00:00.000Z`
   */
  lastDoneAt: text("last_done_at"),
  /** IANA zone for day-boundary math (e.g. Europe/Berlin). Required. */
  zone: text("zone").notNull(),
  status: text("status", { enum: ["active", "paused"] }).notNull(),
  /** Row creation Instant as ISO-8601 text. */
  createdAt: text("created_at").notNull(),
  /** Row update Instant as ISO-8601 text. */
  updatedAt: text("updated_at").notNull(),
});

/** Append-only completion log (facts). Engine reads lastDone; UI may show history. */
export const completions = sqliteTable("completions", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => catalogItems.id),
  /** ISO-8601 Instant when the user marked done. */
  completedAt: text("completed_at").notNull(),
  note: text("note"),
});

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type CatalogItemInsert = typeof catalogItems.$inferInsert;
export type CompletionRow = typeof completions.$inferSelect;
export type CompletionInsert = typeof completions.$inferInsert;
