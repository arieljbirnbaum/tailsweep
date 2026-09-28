/**
 * Row ↔ domain mappers for the DB layer.
 *
 * Strict: bad cadence JSON, empty zone, or invalid Instant ISO throw.
 * No Date. No optional zone → UTC fallback. No silent coercions.
 */

import { InvalidCadenceError } from "@/engine/errors";
import { Temporal } from "@/engine/temporal";
import type {
  Cadence,
  CatalogItem,
  CatalogItemStatus,
  EveryNDaysCadence,
  NamedCadenceKind,
} from "@/engine/types";

import type { CatalogItemRow, CompletionRow } from "./schema";

const NAMED_CADENCE_KINDS = new Set<NamedCadenceKind>([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "as_needed",
]);

const STATUSES = new Set<CatalogItemStatus>(["active", "paused"]);

/** Domain view of a completion log row (facts only). */
export type Completion = {
  readonly id: string;
  readonly itemId: string;
  readonly completedAt: Temporal.Instant;
  readonly note: string | null;
};

export type CatalogItemTimestamps = {
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
};

/** Parse ISO-8601 Instant text. Throws on bad input (Temporal). */
export function instantFromIso(iso: string): Temporal.Instant {
  return Temporal.Instant.from(iso);
}

/** Serialize Instant to ISO-8601 text for storage. */
export function instantToIso(instant: Temporal.Instant): string {
  return instant.toString();
}

/**
 * Strict Cadence JSON parse. Throws InvalidCadenceError on bad shape.
 * No permissive unions (e.g. string|object) beyond the engine Cadence contract.
 */
export function parseCadenceJson(json: string): Cadence {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    throw new InvalidCadenceError(`cadence_json is not valid JSON: ${json}`);
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new InvalidCadenceError(
      `cadence_json must be a JSON object, got ${typeof raw}`,
    );
  }

  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;

  if (typeof kind !== "string") {
    throw new InvalidCadenceError("cadence_json.kind must be a string");
  }

  if (kind === "every_n_days") {
    const days = obj.days;
    if (
      typeof days !== "number" ||
      !Number.isInteger(days) ||
      days < 1 ||
      Object.keys(obj).some((k) => k !== "kind" && k !== "days")
    ) {
      throw new InvalidCadenceError(
        "every_n_days requires positive integer days and no extra keys",
      );
    }
    const cadence: EveryNDaysCadence = { kind: "every_n_days", days };
    return cadence;
  }

  if (!NAMED_CADENCE_KINDS.has(kind as NamedCadenceKind)) {
    throw new InvalidCadenceError(`unknown cadence kind: ${kind}`);
  }

  if (Object.keys(obj).some((k) => k !== "kind")) {
    throw new InvalidCadenceError(`named cadence ${kind} must have only { kind }`);
  }

  return { kind: kind as NamedCadenceKind };
}

export function serializeCadence(cadence: Cadence): string {
  return JSON.stringify(cadence);
}

function requireZone(zone: string): string {
  if (typeof zone !== "string" || zone.trim() === "") {
    throw new TypeError("catalog_items.zone is required (IANA id); no UTC fallback");
  }
  return zone;
}

function requireStatus(status: string): CatalogItemStatus {
  if (!STATUSES.has(status as CatalogItemStatus)) {
    throw new TypeError(`catalog_items.status must be active|paused, got: ${status}`);
  }
  return status as CatalogItemStatus;
}

/** Map a DB row to engine CatalogItem. Throws on bad cadence / zone / Instant. */
export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  const lastDone = row.lastDoneAt === null ? null : instantFromIso(row.lastDoneAt);

  return {
    id: row.id,
    name: row.name,
    cadence: parseCadenceJson(row.cadenceJson),
    lastDone,
    zone: requireZone(row.zone),
    status: requireStatus(row.status),
  };
}

/**
 * Map engine CatalogItem + row timestamps to a DB row shape.
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
    lastDoneAt: item.lastDone === null ? null : instantToIso(item.lastDone),
    zone: requireZone(item.zone),
    status: item.status,
    createdAt: instantToIso(timestamps.createdAt),
    updatedAt: instantToIso(timestamps.updatedAt),
  };
}

export function rowToCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    itemId: row.itemId,
    completedAt: instantFromIso(row.completedAt),
    note: row.note,
  };
}

export function completionToRow(completion: Completion): CompletionRow {
  return {
    id: completion.id,
    itemId: completion.itemId,
    completedAt: instantToIso(completion.completedAt),
    note: completion.note,
  };
}
