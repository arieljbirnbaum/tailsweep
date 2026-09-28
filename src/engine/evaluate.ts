import { NotImplementedError } from "./errors";
import type { Temporal } from "./temporal";
import type {
  CatalogItem,
  EvaluatedItem,
  EvaluateOptions,
} from "./types";

/**
 * Evaluate a single catalog item against `now`.
 *
 * CONTRACT (Ariel implements until tests green) — summary:
 * 1. `now` / `lastDone` are Temporal.Instant.
 * 2. Paused → not_applicable, nextDue null.
 * 3. as_needed + lastDone set → not_applicable; as_needed + never done → due.
 * 4. Completion-anchored: next due local date = lastDone local date + cadence.
 *    Calendar math: Instant → ZonedDateTimeISO(item.zone) → PlainDate → add →
 *    start-of-day Instant in that zone (disambiguation: Temporal default
 *    `compatible`). Never done → overdue (nextDue = start of "today" in zone,
 *    or null — see tests).
 * 5. Compare next-due local calendar date to "today" in zone:
 *    before today → overdue; today → due; after today within horizon → upcoming;
 *    after horizon → not_applicable.
 * 6. Zone: only `item.zone` (required IANA id). No options.timeZone, no "UTC" default.
 * 7. `options.horizonDays` is required (no engine default).
 *
 * @see ARCHITECTURE.md and evaluate.test.ts for the full table-driven contract.
 */
export function evaluateItem(
  item: CatalogItem,
  now: Temporal.Instant,
  options: EvaluateOptions,
): EvaluatedItem {
  // Keep args referenced so the stub signature stays honest for Ariel.
  void item;
  void now;
  void options;
  throw new NotImplementedError("evaluateItem");
}

/**
 * Evaluate many items. Order of results must match input order.
 * Pure map over evaluateItem — no sorting/filtering here (UI/adapters decide).
 */
export function evaluateCatalog(
  items: readonly CatalogItem[],
  now: Temporal.Instant,
  options: EvaluateOptions,
): EvaluatedItem[] {
  return items.map((item) => evaluateItem(item, now, options));
}
