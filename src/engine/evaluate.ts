import { NotImplementedError } from "./errors";
import { assertDate } from "./clock";
import type {
  CatalogItem,
  EvaluatedItem,
  EvaluateOptions,
} from "./types";

/**
 * Evaluate a single catalog item against `now`.
 *
 * CONTRACT (Ariel implements until tests green) — summary:
 * 1. Reject invalid `now` / `lastDone` via InvalidDateError (no string coercion).
 * 2. Paused → not_applicable, nextDue null.
 * 3. as_needed + lastDone set → not_applicable; as_needed + never done → due.
 * 4. Completion-anchored: next due local date = lastDone local date + cadence.
 *    Never done → overdue (nextDue = start of "today" in zone, or null — see tests).
 * 5. Compare next-due local calendar date to "today" in zone:
 *    before today → overdue; today → due; after today within horizon → upcoming;
 *    after horizon → not_applicable.
 * 6. Zone: item.zone ?? options.timeZone ?? "UTC".
 * 7. horizonDays default 7.
 *
 * @see ARCHITECTURE.md and evaluate.test.ts for the full table-driven contract.
 */
export function evaluateItem(
  item: CatalogItem,
  now: Date,
  options?: EvaluateOptions,
): EvaluatedItem {
  assertDate("now", now);
  if (item.lastDone !== null) {
    assertDate(`item(${item.id}).lastDone`, item.lastDone);
  }
  // Keep options referenced so the stub signature stays honest for Ariel.
  void options;
  throw new NotImplementedError("evaluateItem");
}

/**
 * Evaluate many items. Order of results must match input order.
 * Pure map over evaluateItem — no sorting/filtering here (UI/adapters decide).
 */
export function evaluateCatalog(
  items: readonly CatalogItem[],
  now: Date,
  options?: EvaluateOptions,
): EvaluatedItem[] {
  assertDate("now", now);
  return items.map((item) => evaluateItem(item, now, options));
}
