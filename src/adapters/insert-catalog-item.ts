/**
 * Hand-enter a catalog item (dogfood before import).
 *
 * Persistence insert — not due math, and not id minting. The caller supplies
 * the item id and the createdAt/updatedAt Instant. Status is active and
 * lastDone is null. Bad zone / bad cadence fail at domain parsers before write.
 */

import { catalogItems, catalogItemToRow, type Db } from "@/db";
import { parseCatalogItem, type Temporal } from "@/domain";

export type InsertCatalogItemInput = {
  /** Caller-supplied id. This function does not mint one. */
  readonly id: string;
  readonly name: string;
  /**
   * Named cadence kind (`daily` | `weekly` | …) or `every_n_days`.
   * For `every_n_days`, pass positive integer `days` (e.g. 14 for every two weeks).
   * Unknown / incomplete values fail in `parseCadence`.
   */
  readonly cadenceKind: string;
  /**
   * Calendar day count when `cadenceKind` is `every_n_days`.
   * Ignored for named kinds. Required for `every_n_days` (positive int).
   */
  readonly days?: number;
  /** IANA zone. Unknown / padded values fail in `parseZone`. */
  readonly zone: string;
  /** Row `created_at` and `updated_at`. The action passes `systemClock.now()`. */
  readonly at: Temporal.Instant;
};

function cadenceRaw(input: InsertCatalogItemInput): unknown {
  if (input.cadenceKind === "every_n_days") {
    return { kind: "every_n_days", days: input.days };
  }
  return { kind: input.cadenceKind };
}

/**
 * Insert one active, never-done catalog row via `catalogItemToRow`.
 *
 * @throws {InvalidCadenceError} when cadence is not a valid Cadence.
 * @throws {TypeError} when `zone` is not a known IANA id (no UTC fallback).
 * @throws {import("zod").ZodError} when id or name is empty.
 */
export async function insertCatalogItem(
  db: Db,
  input: InsertCatalogItemInput,
): Promise<void> {
  const item = parseCatalogItem({
    id: input.id,
    name: input.name,
    cadence: cadenceRaw(input),
    lastDone: null,
    zone: input.zone,
    status: "active",
  });

  await db
    .insert(catalogItems)
    .values(catalogItemToRow(item, { createdAt: input.at, updatedAt: input.at }));
}
