/**
 * Hand-enter a catalog item (dogfood before import).
 *
 * Persistence insert — not due math, and not id minting. The caller supplies
 * the item id and the createdAt/updatedAt Instant. Status is active and
 * lastDone is null. Bad zone / bad cadence fail before write.
 */

import { catalogItems, catalogItemToRow, type Db } from "@/db";
import {
  cadence,
  parseCatalogItem,
  type CadenceInput,
  type Temporal,
} from "@/domain";

export type InsertCatalogItemInput = {
  /** Caller-supplied id. This function does not mint one. */
  readonly id: string;
  readonly name: string;
  /**
   * Typed cadence input (`{ kind }` or `{ kind: "every_n_days", days }`).
   * Built at the command edge; `cadence()` still enforces positive days.
   */
  readonly cadence: CadenceInput;
  /** IANA zone. Unknown / padded values fail in `parseZone`. */
  readonly zone: string;
  /** Row `created_at` and `updated_at`. The action passes `systemClock.now()`. */
  readonly at: Temporal.Instant;
};

/**
 * Insert one active, never-done catalog row via `catalogItemToRow`.
 *
 * @throws {InvalidCadenceError} when `cadence` fails `cadence()` (e.g. days < 1).
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
    cadence: cadence(input.cadence),
    lastDone: null,
    zone: input.zone,
    status: "active",
  });

  await db
    .insert(catalogItems)
    .values(catalogItemToRow(item, { createdAt: input.at, updatedAt: input.at }));
}
