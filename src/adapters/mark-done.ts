/**
 * Mark an item done: append a completion log row and set catalog lastDone.
 *
 * Persistence mutation — not due math. The engine stays pure.
 * Both writes run in one DB transaction. No clock, no UUID, no string|Instant
 * coercion, no silent defaults.
 */

import { eq } from "drizzle-orm";

import { catalogItems, completions, instantToIso, type Db } from "@/db";
import type { Temporal } from "@/domain";

import { CatalogItemNotFoundError } from "./errors";

export type MarkDoneInput = {
  readonly itemId: string;
  /** Required Instant. Callers construct it; this function does not read a clock. */
  readonly completedAt: Temporal.Instant;
  /** Caller-supplied id so tests (and retries) stay deterministic. */
  readonly completionId: string;
  /** Omit or null → SQL null. No default note. */
  readonly note?: string | null;
};

/**
 * Append one completion and set `catalog_items.last_done_at` to exactly
 * `completedAt` (ISO of that Instant).
 *
 * Does not clamp, reject, or reorder when `completedAt` is before the previous
 * lastDone — the fact is recorded as given. Does not special-case paused.
 * Does not rewrite `created_at` / `updated_at` (no clock inside the mutation).
 *
 * @throws {CatalogItemNotFoundError} when `itemId` is not in the catalog.
 *   No completion row is inserted and lastDone is unchanged (transaction rolls back).
 */
export async function markDone(db: Db, input: MarkDoneInput): Promise<void> {
  const completedAtIso = instantToIso(input.completedAt);
  const note = input.note ?? null;

  await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(eq(catalogItems.id, input.itemId));

    if (found[0] === undefined) {
      throw new CatalogItemNotFoundError(input.itemId);
    }

    await tx.insert(completions).values({
      id: input.completionId,
      itemId: input.itemId,
      completedAt: completedAtIso,
      note,
    });

    await tx
      .update(catalogItems)
      .set({ lastDoneAt: completedAtIso })
      .where(eq(catalogItems.id, input.itemId));
  });
}
