/**
 * CatalogItem domain schemas + parse helpers.
 * Zone is required non-empty (no UTC default). Status is active|paused.
 * Instant fields are Temporal.Instant (ISO parsed at the boundary).
 */

import { z } from "zod";

import { cadenceSchema, parseCadence, parseCadenceJson, type Cadence } from "./cadence";
import { instantToIso, parseInstant, parseNullableInstantIso } from "./instant";
import type { Temporal } from "./temporal";

export const catalogItemStatusSchema = z.enum(["active", "paused"]);

export type CatalogItemStatus = z.infer<typeof catalogItemStatusSchema>;

/**
 * IANA zone id — non-empty, no whitespace-only.
 * No trim coercion; empty/blank fails loud.
 */
export const zoneSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "zone is required (IANA id); no UTC fallback",
});

/**
 * Wire/JSON shape for a catalog item (lastDone as ISO string or null).
 * Used when parsing from persistence or external payloads.
 */
export const catalogItemWireSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    cadence: cadenceSchema,
    lastDone: z.union([z.string().min(1), z.null()]),
    zone: zoneSchema,
    status: catalogItemStatusSchema,
  })
  .strict();

export type CatalogItemWire = z.infer<typeof catalogItemWireSchema>;

/**
 * A catalog (chore/routine) item.
 * `lastDone` is a Temporal.Instant (UTC). Cadence advances on the item’s local
 * civil calendar in required `zone`; `nextDue` is the Instant at start of that
 * due local day in `zone`. Contract check: Instant.equals on SOD Instants.
 * (Intent, not a prescribed Instant→ZDT→add→startOfDay / PlainDate pipeline.)
 */
export type CatalogItem = {
  readonly id: string;
  readonly name: string;
  readonly cadence: Cadence;
  /** Instant of last completion, or null if never done. */
  readonly lastDone: Temporal.Instant | null;
  /**
   * IANA time zone for day-boundary math (e.g. "Europe/Berlin").
   * Required — evaluate* uses only `item.zone` (no options fallback, no UTC default).
   */
  readonly zone: string;
  readonly status: CatalogItemStatus;
};

/** Fail-loud zone parse. Throws TypeError (no UTC fallback). */
export function parseZone(zone: unknown): string {
  const result = zoneSchema.safeParse(zone);
  if (!result.success) {
    throw new TypeError("catalog_items.zone is required (IANA id); no UTC fallback");
  }
  return result.data;
}

/** Fail-loud status parse. */
export function parseCatalogItemStatus(status: unknown): CatalogItemStatus {
  const result = catalogItemStatusSchema.safeParse(status);
  if (!result.success) {
    throw new TypeError(
      `catalog_items.status must be active|paused, got: ${String(status)}`,
    );
  }
  return result.data;
}

/**
 * Build CatalogItem from already-typed pieces (cadence object, Instant|null).
 * Validates zone/status/id/name; Instant accepted as Instant or ISO string.
 */
export function parseCatalogItem(input: {
  id: unknown;
  name: unknown;
  cadence: unknown;
  lastDone: unknown;
  zone: unknown;
  status: unknown;
}): CatalogItem {
  const id = z.string().min(1).parse(input.id);
  const name = z.string().min(1).parse(input.name);
  const cadence = parseCadence(input.cadence);
  const zone = parseZone(input.zone);
  const status = parseCatalogItemStatus(input.status);

  const lastDone = input.lastDone === null ? null : parseInstant(input.lastDone);

  return { id, name, cadence, lastDone, zone, status };
}

/**
 * Parse persistence row fields → CatalogItem.
 * `cadenceJson` is JSON text; `lastDoneAt` is ISO Instant text or null.
 */
export function parseCatalogItemFromRow(row: {
  id: string;
  name: string;
  cadenceJson: string;
  lastDoneAt: string | null;
  zone: string;
  status: string;
}): CatalogItem {
  return {
    id: z.string().min(1).parse(row.id),
    name: z.string().min(1).parse(row.name),
    cadence: parseCadenceJson(row.cadenceJson),
    lastDone: parseNullableInstantIso(row.lastDoneAt),
    zone: parseZone(row.zone),
    status: parseCatalogItemStatus(row.status),
  };
}

/** Serialize lastDone Instant for storage (null → null). */
export function lastDoneToIso(lastDone: Temporal.Instant | null): string | null {
  return lastDone === null ? null : instantToIso(lastDone);
}
