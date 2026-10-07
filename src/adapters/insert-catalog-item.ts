/**
 * Hand-enter a catalog item (dogfood before import).
 *
 * Persistence insert — not due math, and not id minting. The caller supplies
 * the item id and the createdAt/updatedAt Instant. Status is active and
 * lastDone is null. Bad zone fails before write. Cadence must already be
 * branded (command edge / tests call cadence or cadenceFromForm).
 */

import { catalogItems, catalogItemToRow, type Db } from "@/db";
import { parseCatalogItem, type Cadence, type Temporal } from "@/domain";

export type InsertCatalogItemInput = {
  /** Caller-supplied id. This function does not mint one. */
  readonly id: string;
  readonly name: string;
  /** Branded Cadence from `cadence` / `parseCadence` / `cadenceFromForm`. */
  readonly cadence: Cadence;
  /** IANA zone. Unknown / padded values fail in `parseZone`. */
  readonly zone: string;
  /** Row `created_at` and `updated_at`. The action passes `systemClock.now()`. */
  readonly at: Temporal.Instant;
};

/**
 * Insert one active, never-done catalog row via `catalogItemToRow`.
 *
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
    cadence: input.cadence,
    lastDone: null,
    zone: input.zone,
    status: "active",
  });

  await db
    .insert(catalogItems)
    .values(catalogItemToRow(item, { createdAt: input.at, updatedAt: input.at }));
}
