/**
 * Row ↔ domain mappers for the DB layer.
 *
 * Strict: bad cadence JSON, empty zone, or invalid Instant ISO throw.
 * No Date. No optional zone → UTC fallback. No silent coercions.
 * Domain parse helpers own validation; this module only maps shapes.
 */

import type { Temporal } from "@/domain";
import {
  instantToIso,
  lastDoneToIso,
  parseCadenceJson,
  parseCatalogItemFromRow,
  parseCompletion,
  parseInstantIso,
  parseZone,
  serializeCadence,
  type CatalogItem,
  type Completion,
} from "@/domain";

import type { CatalogItemRow, CompletionRow } from "./schema";

export type { Completion };

export type CatalogItemTimestamps = {
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

/** Parse ISO-8601 Instant text. Throws on bad input. */
export function instantFromIso(iso: string): Temporal.Instant {
  return parseInstantIso(iso);
}

export { instantToIso, parseCadenceJson, serializeCadence };

/** Map a DB row to domain CatalogItem. Throws on bad cadence / zone / Instant. */
export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return parseCatalogItemFromRow({
    id: row.id,
    name: row.name,
    cadenceJson: row.cadenceJson,
    lastDoneAt: row.lastDoneAt,
    zone: row.zone,
    status: row.status,
  });
}

/**
 * Map domain CatalogItem + row timestamps to a DB row shape.
 * Callers supply createdAt/updatedAt Instants (adapters/UX decide defaults).
 */
export function catalogItemToRow(
  item: CatalogItem,
  timestamps: CatalogItemTimestamps,
): CatalogItemRow {
  return {
    id: item.id,
    name: item.name,
    cadenceJson: serializeCadence(item.cadence),
    lastDoneAt: lastDoneToIso(item.lastDone),
    zone: parseZone(item.zone),
    status: item.status,
    createdAt: instantToIso(timestamps.createdAt),
    updatedAt: instantToIso(timestamps.updatedAt),
  };
}

export function rowToCompletion(row: CompletionRow): Completion {
  return parseCompletion({
    id: row.id,
    itemId: row.itemId,
    completedAt: row.completedAt,
    note: row.note,
  });
}

export function completionToRow(completion: Completion): CompletionRow {
  return {
    id: completion.id,
    itemId: completion.itemId,
    completedAt: instantToIso(completion.completedAt),
    note: completion.note,
  };
}
