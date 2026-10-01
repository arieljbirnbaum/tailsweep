/**
 * EvaluateOptions schema + factories / parse helpers.
 * Source of truth for horizonDays (positive integer >= 1).
 * Prefer evaluateOptions for in-app construction (typed input).
 * Use parseEvaluateOptions for unknown / deserialization boundaries.
 * Engine imports the branded type only; adapters/UX call `evaluateOptions` or parse* at the edge.
 * Defaults belong in UX/adapters — never in the engine.
 */

import { z } from "zod";

/**
 * Required evaluate options. `horizonDays` is a positive integer (>= 1).
 * Branded so invalid values cannot be constructed through the public API.
 */
export const evaluateOptionsSchema = z
  .object({
    horizonDays: z.number().int().positive(),
  })
  .strict()
  .brand<"EvaluateOptions">();

export type EvaluateOptions = z.infer<typeof evaluateOptionsSchema>;

/** Typed input for in-app EvaluateOptions construction (not unknown). */
export type EvaluateOptionsInput = {
  horizonDays: number;
};

/**
 * Construct branded EvaluateOptions from a typed input.
 * Preferred over parseEvaluateOptions inside the app.
 * Throws RangeError wrapping Zod's formatted message on invalid values.
 */
export function evaluateOptions(
  input: EvaluateOptionsInput,
): EvaluateOptions {
  return parseEvaluateOptions(input);
}

/**
 * Strict EvaluateOptions parse from unknown (deserialization / boundary).
 * Throws RangeError wrapping Zod's formatted error (z.prettifyError).
 * No permissive coercions; no defaults. Engine trusts the branded result.
 */
export function parseEvaluateOptions(raw: unknown): EvaluateOptions {
  const result = evaluateOptionsSchema.safeParse(raw);
  if (!result.success) {
    throw new RangeError(z.prettifyError(result.error));
  }
  return result.data;
}
