/**
 * Cadence schemas + factories / parse helpers.
 * Source of truth for Cadence shape and constraints (positive every_n_days.days).
 * Branded opaque Cadence: invalid values cannot be built via createCadence /
 * parseCadence / parseCadenceJson.
 * Prefer createCadence for in-app construction (typed input).
 * Use parseCadence / parseCadenceJson for unknown / JSON deserialization boundaries.
 * Engine imports the branded type only; adapters/persistence call create* or parse* at the edge.
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

/** Internal named cadence: { kind } only. */
const namedCadenceSchema = z
  .object({
    kind: namedCadenceKindSchema,
  })
  .strict();

/**
 * Fixed interval of N calendar days (completion-anchored).
 * `days` must be a positive integer (>= 1).
 */
const everyNDaysCadenceSchema = z
  .object({
    kind: z.literal("every_n_days"),
    days: z.number().int().positive(),
  })
  .strict();

/**
 * Branded Cadence — how often an item should be completed again after lastDone.
 * Named kinds use calendar periods in the item's zone; `every_n_days` adds a
 * fixed day count. Valid-by-construction via createCadence / parseCadence /
 * parseCadenceJson. Plain literals are not assignable. ESLint blanket-bans type
 * assertions except `as const` / `<const>` (other escapes need a scoped carve-out;
 * never chained). The engine trusts branded inputs and does not re-validate.
 */
export const cadenceSchema = z
  .union([namedCadenceSchema, everyNDaysCadenceSchema])
  .brand<"Cadence">();

export type Cadence = z.infer<typeof cadenceSchema>;

/**
 * Typed input for in-app Cadence construction (not unknown).
 * Named kinds or every_n_days with a days number — runtime Zod still enforces
 * positive integer days / no extra keys.
 */
export type CreateCadenceInput =
  | { kind: NamedCadenceKind }
  | { kind: "every_n_days"; days: number };

function invalidCadenceFromZod(error: z.ZodError): InvalidCadenceError {
  return new InvalidCadenceError(z.prettifyError(error));
}

/**
 * Construct branded Cadence from a typed input.
 * Preferred over parseCadence inside the app.
 * Throws InvalidCadenceError wrapping Zod's formatted message on bad shape.
 */
export function createCadence(input: CreateCadenceInput): Cadence {
  return parseCadence(input);
}

/**
 * Strict Cadence parse from unknown (deserialization / boundary).
 * Throws InvalidCadenceError wrapping Zod's formatted error (z.prettifyError).
 * No permissive coercions.
 */
export function parseCadence(raw: unknown): Cadence {
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw invalidCadenceFromZod(result.error);
  }
  return result.data;
}

/**
 * Strict Cadence JSON parse.
 * SyntaxError (JSON parse failure) → InvalidCadenceError.
 * Bad shape (Zod) → InvalidCadenceError wrapping Zod formatting via parseCadence.
 */
export function parseCadenceJson(json: string): Cadence {
  let raw: unknown;
  try {
    // JSON.parse is `any`; assign into unknown without assertion.
    raw = JSON.parse(json);
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    throw new InvalidCadenceError(`cadence_json is not valid JSON: ${message}`);
  }
  return parseCadence(raw);
}

export function serializeCadence(cadence: Cadence): string {
  return JSON.stringify(cadence);
}
