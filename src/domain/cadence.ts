/**
 * Cadence schemas + parse helpers.
 * Source of truth for Cadence shape and constraints (positive every_n_days.days).
 * Engine imports types only; adapters/persistence call parse* at the boundary.
 */

import { z } from "zod";

import { InvalidCadenceError } from "./errors";

const NAMED_KINDS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "as_needed",
] as const;

export const namedCadenceKindSchema = z.enum(NAMED_KINDS);

export type NamedCadenceKind = z.infer<typeof namedCadenceKindSchema>;

/** Named cadence: { kind } only — extra keys rejected (.strict()). */
export const namedCadenceSchema = z
  .object({
    kind: namedCadenceKindSchema,
  })
  .strict();

export type NamedCadence = z.infer<typeof namedCadenceSchema>;

/**
 * Fixed interval of N calendar days (completion-anchored).
 * `days` must be a positive integer (≥ 1).
 */
export const everyNDaysCadenceSchema = z
  .object({
    kind: z.literal("every_n_days"),
    days: z.number().int().positive(),
  })
  .strict();

export type EveryNDaysCadence = z.infer<typeof everyNDaysCadenceSchema>;

/**
 * How often an item should be completed again after lastDone.
 * - Named kinds use calendar periods in the item's time zone.
 * - `every_n_days` adds a fixed day count from lastDone's local date.
 */
export const cadenceSchema = z.union([namedCadenceSchema, everyNDaysCadenceSchema]);

export type Cadence = z.infer<typeof cadenceSchema>;

/**
 * Stable human-readable InvalidCadenceError copy (not Zod's "Too small" /
 * "Invalid input"). Prefer prior hand-rolled messages from the mapper era.
 */
function cadenceFailureMessage(raw: unknown, source: "cadence" | "cadence_json"): string {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return source === "cadence_json"
      ? `cadence_json must be a JSON object, got ${typeof raw}`
      : `cadence must be a JSON object, got ${typeof raw}`;
  }

  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;

  if (typeof kind !== "string") {
    return source === "cadence_json"
      ? "cadence_json.kind must be a string"
      : "cadence.kind must be a string";
  }

  if (kind === "every_n_days") {
    return "every_n_days requires positive integer days and no extra keys";
  }

  if ((NAMED_KINDS as readonly string[]).includes(kind)) {
    return `named cadence ${kind} must have only { kind }`;
  }

  return `unknown cadence kind: ${kind}`;
}

/**
 * Strict Cadence parse from unknown. Throws InvalidCadenceError on bad shape.
 * No permissive coercions (string|object unions beyond the Cadence contract).
 */
export function parseCadence(raw: unknown): Cadence {
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidCadenceError(cadenceFailureMessage(raw, "cadence"));
  }
  return result.data;
}

/**
 * Strict Cadence JSON parse. Throws InvalidCadenceError on bad JSON or shape.
 */
export function parseCadenceJson(json: string): Cadence {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    throw new InvalidCadenceError(`cadence_json is not valid JSON: ${json}`);
  }
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidCadenceError(cadenceFailureMessage(raw, "cadence_json"));
  }
  return result.data;
}

export function serializeCadence(cadence: Cadence): string {
  return JSON.stringify(cadence);
}
