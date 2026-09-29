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

function cadenceParseMessage(err: z.ZodError): string {
  const first = err.issues[0];
  if (!first) return "invalid cadence";
  const path = first.path.length > 0 ? first.path.join(".") : "cadence";
  return `${path}: ${first.message}`;
}

/**
 * Strict Cadence parse from unknown. Throws InvalidCadenceError on bad shape.
 * No permissive coercions (string|object unions beyond the Cadence contract).
 */
export function parseCadence(raw: unknown): Cadence {
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidCadenceError(cadenceParseMessage(result.error));
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
  return parseCadence(raw);
}

export function serializeCadence(cadence: Cadence): string {
  return JSON.stringify(cadence);
}
