/**
 * CatalogItem domain schemas + parse helpers.
 * Zone is required IANA (tzdata membership via Intl/Temporal; no UTC default).
 * Status is active|paused. Instant fields are Temporal.Instant (ISO at boundary).
 */

import { z } from "zod";

import { cadenceSchema, parseCadence, parseCadenceJson, type Cadence } from "./cadence";
import { instantToIso, parseInstant, parseNullableInstantIso } from "./instant";
import { Temporal } from "./temporal";

export const catalogItemStatusSchema = z.enum(["active", "paused"]);

/** Catalog item display name: non-empty string. */
export const catalogItemNameSchema = z.string().min(1);

export type CatalogItemStatus = z.infer<typeof catalogItemStatusSchema>;

/**
 * IANA zone ids from runtime tzdata (`Intl.supportedValuesOf("timeZone")`).
 * Built once; null when the API is unavailable (Temporal fallback then).
 */
const IANA_TIME_ZONES: ReadonlySet<string> | null =
  typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function"
    ? new Set(Intl.supportedValuesOf("timeZone"))
    : null;

/**
 * True if `zone` is a real IANA id for this runtime.
 * Prefer Intl Set membership; fall back to Temporal (covers ids Intl omits,
 * e.g. "UTC", and environments without supportedValuesOf).
 */
function isKnownIanaTimeZone(zone: string): boolean {
  if (IANA_TIME_ZONES?.has(zone)) return true;
  try {
    Temporal.Now.instant().toZonedDateTimeISO(zone);
    return true;
  } catch {
    return false;
  }
}

/**
 * IANA zone id — non-empty, no whitespace pad, must be in runtime tzdata.
 * No trim coercion; padded / unknown ids fail loud at parse (not only evaluate).
 */
export const zoneSchema = z.string().superRefine((value, ctx) => {
  if (value.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "zone is required (IANA id); no UTC fallback",
    });
    return;
  }
  if (value !== value.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "zone must not have leading/trailing whitespace (no trim coercion)",
    });
    return;
  }
  if (!isKnownIanaTimeZone(value)) {
    ctx.addIssue({
      code: "custom",
      message: `unknown IANA time zone: ${value}`,
    });
  }
});

/**
 * Wire/JSON shape for a catalog item (lastDone as ISO string or null).
 * Used when parsing from persistence or external payloads.
 */
export const catalogItemWireSchema = z
  .object({
    id: z.string().min(1),
    name: catalogItemNameSchema,
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
 */
export type CatalogItem = {
  readonly id: string;
  readonly name: string;
  readonly cadence: Cadence;
  /** Instant of last completion, or null if never done. */
  readonly lastDone: Temporal.Instant | null;
  /** IANA time zone for day-boundary math (e.g. "Europe/Berlin"). */
  readonly zone: string;
  readonly status: CatalogItemStatus;
};

/** Fail-loud zone parse (tzdata membership). Throws TypeError (no UTC fallback). */
export function parseZone(zone: unknown): string {
  const result = zoneSchema.safeParse(zone);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? "invalid zone";
    throw new TypeError(
      detail.startsWith("zone ")
        ? `catalog_items.${detail}`
        : `catalog_items.zone: ${detail}`,
    );
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
  const name = catalogItemNameSchema.parse(input.name);
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
