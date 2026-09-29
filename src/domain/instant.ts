/**
 * Instant ISO round-trip helpers.
 * Zod validates string shape; Temporal constructs the Instant (throws on bad ISO).
 * No Date. No silent coercion.
 */

import { z } from "zod";

import { Temporal } from "./temporal";

/** Non-empty ISO Instant text (construction still done by Temporal). */
export const instantIsoSchema = z.string().min(1);

/**
 * Parse ISO-8601 Instant text → Temporal.Instant.
 * Throws ZodError on empty/non-string; Temporal RangeError/TypeError on bad ISO.
 */
export function parseInstantIso(iso: unknown): Temporal.Instant {
  const text = instantIsoSchema.parse(iso);
  return Temporal.Instant.from(text);
}

/** Nullable Instant ISO (null stays null; undefined rejected). */
export function parseNullableInstantIso(iso: unknown): Temporal.Instant | null {
  if (iso === null) return null;
  return parseInstantIso(iso);
}

/**
 * Accept an already-constructed Instant (instanceof check) or ISO string.
 * Fail-loud — no Date, no number epoch ms.
 */
export function parseInstant(value: unknown): Temporal.Instant {
  if (value instanceof Temporal.Instant) return value;
  return parseInstantIso(value);
}

/** Serialize Instant to ISO-8601 text for storage. */
export function instantToIso(instant: Temporal.Instant): string {
  return instant.toString();
}
