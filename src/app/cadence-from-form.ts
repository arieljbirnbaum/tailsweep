/**
 * Form strings → branded Cadence at the command edge.
 *
 * Days must be a strict decimal positive integer string (no spaces, no
 * scientific / hex Number() coercions). Shape / positivity still go through
 * parseCadence so no-argument kind + days and other forgeries fail the same way as domain.
 */

import {
  InvalidCadenceError,
  parseCadence,
  type Cadence,
} from "@/domain";

/**
 * Strict positive decimal integer text → number.
 * Rejects "", "0", "-1", "1.5", " 14 ", "1e1", "0x0e", "014", etc.
 */
export function parseStrictPositiveIntDecimal(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const days = Number(raw);
  if (!Number.isSafeInteger(days)) return null;
  return days;
}

/**
 * @throws {InvalidCadenceError} on missing/lax days, unknown kind, or
 *   no-argument kind + days (via parseCadence .strict()).
 */
export function cadenceFromForm(
  cadenceKind: string,
  daysRaw: string | null,
): Cadence {
  if (cadenceKind === "every_n_days") {
    if (daysRaw === null || daysRaw.length === 0) {
      throw new InvalidCadenceError(
        "Days is required for every_n_days (e.g. 14 for every two weeks).",
      );
    }
    const days = parseStrictPositiveIntDecimal(daysRaw);
    if (days === null) {
      throw new InvalidCadenceError(
        `Days must be a positive decimal integer string; got ${JSON.stringify(daysRaw)}`,
      );
    }
    return parseCadence({ kind: "every_n_days", days });
  }

  if (daysRaw !== null && daysRaw.length > 0) {
    // Extra key on a no-argument cadence — domain .strict() rejects.
    return parseCadence({ kind: cadenceKind, days: daysRaw });
  }

  return parseCadence({ kind: cadenceKind });
}
