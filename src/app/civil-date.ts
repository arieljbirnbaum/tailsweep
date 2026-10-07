/**
 * Display formatting for a due Instant.
 *
 * Pure: no clock, no catalog, no cadence math. The civil date is the local
 * calendar day of that Instant in the item zone (Temporal ZDT → PlainDate).
 */

import type { Temporal } from "@/engine";

/**
 * `YYYY-MM-DD` civil date of `instant` in IANA `zone`.
 * Not the UTC calendar date — a Berlin evening can be the next local day.
 */
export function formatCivilDate(instant: Temporal.Instant, zone: string): string {
  return instant.toZonedDateTimeISO(zone).toPlainDate().toString();
}
