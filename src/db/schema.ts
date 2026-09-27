/**
 * Drizzle schema placeholders for catalog + completions.
 *
 * IMPORTANT: due math does NOT live here. Persist facts (lastDone, cadence);
 * compute DueState via src/engine at the adapter/UI edge.
 */

import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Catalog chores/routines. Cadence stored as JSON text matching engine Cadence. */
export const catalogItems = sqliteTable("catalog_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** JSON-serialized Cadence from src/engine */
  cadenceJson: text("cadence_json").notNull(),
  /** ISO-8601 instant or null */
  lastDoneAt: text("last_done_at"),
  /** IANA zone, e.g. Europe/Berlin */
  zone: text("zone"),
  status: text("status", { enum: ["active", "paused"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Append-only completion log (facts). Engine reads lastDone; UI may show history. */
export const completions = sqliteTable("completions", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => catalogItems.id),
  /** ISO-8601 instant when the user marked done */
  completedAt: text("completed_at").notNull(),
  note: text("note"),
});

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type CompletionRow = typeof completions.$inferSelect;
