/**
 * EvaluateOptions schema + parse helper.
 * Source of truth for horizonDays (positive integer ≥ 1).
 * Engine imports the branded type only; adapters/UX call parse* at the boundary.
 * Defaults belong in UX/adapters — never in the engine.
 */

import { z } from "zod";

/**
 * Required evaluate options. `horizonDays` is a positive integer (≥ 1).
 * Branded so invalid values cannot be constructed through the public parse API.
 */
export const evaluateOptionsSchema = z
  .object({
    horizonDays: z.number().int().positive(),
  })
  .strict()
  .brand<"EvaluateOptions">();

export type EvaluateOptions = z.infer<typeof evaluateOptionsSchema>;

/**
 * Strict EvaluateOptions parse from unknown.
 * Throws RangeError on ≤ 0 / non-integer / bad shape (same contract as the
 * engine’s cheap last-line assert). No permissive coercions; no defaults.
 */
export function parseEvaluateOptions(raw: unknown): EvaluateOptions {
  const result = evaluateOptionsSchema.safeParse(raw);
  if (!result.success) {
    const horizon =
      raw !== null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>).horizonDays
        : raw;
    throw new RangeError(
      `horizonDays must be a positive integer, got ${String(horizon)}`,
    );
  }
  return result.data;
}
