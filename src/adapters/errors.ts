/**
 * Typed errors for adapter mutations.
 * Live outside `src/engine` — the engine stays pure due math.
 * Never swallow these.
 */

/** `markDone` was asked to record a completion for an id that is not in the catalog. */
export class CatalogItemNotFoundError extends Error {
  readonly code = "CATALOG_ITEM_NOT_FOUND" as const;

  readonly itemId: string;

  constructor(itemId: string) {
    super(`CatalogItemNotFoundError: no catalog item with id "${itemId}"`);
    this.name = "CatalogItemNotFoundError";
    this.itemId = itemId;
  }
}
