import { match, P } from "ts-pattern";
import { InvalidCadenceError } from "./errors";
import { Temporal } from "./temporal";
import {
  type Cadence,
  type DueState,
  type CatalogItem,
  type EvaluatedItem,
  type EvaluateOptions,
} from "./types";

/**
 * Cheap last-line brand-integrity check for horizonDays.
 * Primary validation lives in domain `parseEvaluateOptions` (valid-by-construction).
 * This is NOT a Zod re-parse — only a structural invariant until branded
 * EvaluateOptions is the exclusive door (TS `as EvaluateOptions` is a hole).
 */
function assertHorizonDays(horizonDays: number): void {
  if (!Number.isInteger(horizonDays) || horizonDays <= 0) {
    throw new RangeError(
      `horizonDays must be a positive integer, got ${String(horizonDays)}`,
    );
  }
}

/**
 * Cheap last-line brand-integrity check for every_n_days.days.
 * Primary validation lives in domain `parseCadence` / `parseCadenceJson`.
 * Not a Zod re-parse — structural only until branded Cadence is exclusive.
 */
function assertEveryNDays(days: number): void {
  if (!Number.isInteger(days) || days <= 0) {
    throw new InvalidCadenceError(
      `every_n_days.days must be a positive integer, got ${String(days)}`,
    );
  }
}

/** Fail-loud cadence brand-integrity checks before any early return (including paused). */
function assertCadence(cadence: Cadence): void {
  if (cadence.kind === "every_n_days") {
    assertEveryNDays(cadence.days);
  }
}

/**
 * Evaluate a single catalog item against `now`.
 *
 * CONTRACT — summary:
 * 1. Paused → not_applicable, nextDue null.
 * 2. as_needed + lastDone set → not_applicable (nextDue null); as_needed +
 *    never done → due (nextDue = start of today in item.zone).
 * 3. Completion-anchored calendar intent: cadence advances on the item’s local
 *    civil calendar in `item.zone`; `nextDue` is the Instant at start of that
 *    due local day. Month-end / leap overflow uses Temporal constrain (e.g.
 *    Jan 31 + monthly → Feb 28; Feb 29 + yearly → Feb 28 in a non-leap year).
 *    Contract check: Instant.equals on SOD Instants. Midnight/DST uses
 *    Temporal’s default disambiguation `compatible` (lock in tests). Not a
 *    prescribed Instant→ZDT→add→startOfDay / PlainDate call pipeline. Scheduled
 *    never done → overdue (nextDue = start of today in item.zone).
 * 4. Compare next-due SOD Instant to "today" SOD Instant in zone:
 *    before today → overdue; today → due; after today within horizon → upcoming;
 *    after horizon → not_applicable.
 *
 * Preconditions (v1): `item.cadence` and `options` are branded domain types
 * constructed via `parseCadence` / `parseEvaluateOptions` (or CatalogItem
 * parsers). evaluate* trusts those opaque inputs and keeps only cheap
 * structural last-line asserts for brand integrity (not Zod re-parse) until
 * parse/factories are the exclusive door.
 *
 * @see ARCHITECTURE.md and evaluate.test.ts for the full table-driven contract.
 */
export function evaluateItem(
  item: CatalogItem,
  now: Temporal.Instant,
  options: EvaluateOptions,
): EvaluatedItem {
  assertHorizonDays(options.horizonDays);

  const { id: itemId, status, cadence, lastDone } = item;
  assertCadence(cadence);

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
 * Validates horizonDays even for an empty catalog (brand-integrity last-line).
 */
export function evaluateCatalog(
  items: readonly CatalogItem[],
  now: Temporal.Instant,
  options: EvaluateOptions,
): EvaluatedItem[] {
  assertHorizonDays(options.horizonDays);
  return items.map((item) => evaluateItem(item, now, options));
}
