/**
 * Load catalog (+ completions) from persistence via domain-backed mappers.
 * Fail-loud: bad cadence / zone / Instant ISO throw at the mapper boundary.
 */

import type { CatalogItem, Completion } from "@/domain";
import {
  catalogItems,
  completions,
  rowToCatalogItem,
  rowToCompletion,
  type Db,
} from "@/db";

/** Load all catalog rows → CatalogItem[] (domain parsers via rowToCatalogItem). */
export async function loadCatalog(db: Db): Promise<CatalogItem[]> {
  const rows = await db.select().from(catalogItems);
  return rows.map(rowToCatalogItem);
}

/**
 * Load append-only completion log → Completion[].
 * Not required for evaluate* (lastDone lives on the catalog row); exposed for
 * history / mark-done edges.
 */
export async function loadCompletions(db: Db): Promise<Completion[]> {
  const rows = await db.select().from(completions);
  return rows.map(rowToCompletion);
}
