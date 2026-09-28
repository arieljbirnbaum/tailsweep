import { match, P } from "ts-pattern";
import { Temporal } from "./temporal";
import {
  type Cadence,
  type DueState,
  type CatalogItem,
  type EvaluatedItem,
  type EvaluateOptions,
} from "./types";

/**
 * Evaluate a single catalog item against `now`.
 *
 * CONTRACT — summary:
 * 1. Paused → not_applicable, nextDue null.
 * 2. as_needed + lastDone set → not_applicable (nextDue null); as_needed +
 *    never done → due (nextDue = start of today in item.zone).
 * 3. Completion-anchored calendar path: Instant → ZonedDateTimeISO(item.zone)
 *    → add cadence Duration → startOfDay → Instant. ZDT.add / startOfDay use
 *    Temporal’s default disambiguation `compatible`. The SOD Instant is what
 *    the contract compares. Scheduled never done → overdue (nextDue = start of
 *    today in item.zone).
 * 4. Compare next-due SOD to "today" SOD in zone:
 *    before today → overdue; today → due; after today within horizon → upcoming;
 *    after horizon → not_applicable.
 *
 * @see ARCHITECTURE.md and evaluate.test.ts for the full table-driven contract.
 */
export function evaluateItem(
  item: CatalogItem,
  now: Temporal.Instant,
  options: EvaluateOptions,
): EvaluatedItem {
  const { id: itemId, status, cadence, lastDone } = item;

  if (status === "paused") {
    return { itemId, nextDue: null, state: "not_applicable" };
  }

  const todayLocal = now.toZonedDateTimeISO(item.zone).startOfDay();

  // TODO: Cadence should carry Temporal.Duration already.
  const cadenceInterval = match<Cadence, Temporal.DurationLike | null>(cadence)
    .with({ kind: "daily" }, () => ({ days: 1 }))
    .with({ kind: "weekly" }, () => ({ weeks: 1 }))
    .with({ kind: "monthly" }, () => ({ months: 1 }))
    .with({ kind: "quarterly" }, () => ({ months: 3 }))
    .with({ kind: "yearly" }, () => ({ years: 1 }))
    .with({ kind: "every_n_days", days: P.select("days") }, ({ days }) => ({ days }))
    .with({ kind: "as_needed" }, () => null)
    .exhaustive();

  if (cadenceInterval === null) {
    return lastDone === null
      ? { itemId, nextDue: todayLocal.toInstant(), state: "due" }
      : { itemId, nextDue: null, state: "not_applicable" };
  }

  const cadenceIntervalDuration = Temporal.Duration.from(cadenceInterval);

  if (lastDone === null) {
    return { itemId, nextDue: todayLocal.toInstant(), state: "overdue" };
  }

  const nextDueLocal = lastDone
    .toZonedDateTimeISO(item.zone)
    .add(cadenceIntervalDuration)
    .startOfDay();
  const nextDue = nextDueLocal.toInstant();

  const state = match<Temporal.ComparisonResult, DueState>(
    Temporal.ZonedDateTime.compare(nextDueLocal, todayLocal),
  )
    .with(-1, () => "overdue")
    .with(0, () => "due")
    .with(1, () =>
      Temporal.ZonedDateTime.compare(
        nextDueLocal,
        todayLocal.add({ days: options.horizonDays }),
      ) > 0
        ? "not_applicable"
        : "upcoming",
    )
    .exhaustive();

  return { itemId, nextDue, state };
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
