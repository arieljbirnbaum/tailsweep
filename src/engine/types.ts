/**
 * Pure domain types for Duekeep's completion-anchored due engine.
 * No UI / DB / IO / fetch / fs imports allowed in this module tree.
 */

import type { Temporal } from "./temporal";

/** Named cadence kinds (calendar-aligned). */
export type NamedCadenceKind =
  "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "as_needed";

/** Fixed interval of N calendar days (completion-anchored). */
export type EveryNDaysCadence = {
  readonly kind: "every_n_days";
  /** Positive integer; 1 ≈ daily but not calendar-day-aligned the same way. */
  readonly days: number;
};

export type NamedCadence = {
  readonly kind: NamedCadenceKind;
};

/**
 * How often an item should be completed again after lastDone.
 * - Named kinds use calendar periods in the item's time zone.
 * - `every_n_days` adds a fixed day count from lastDone's local date.
 */
export type Cadence = NamedCadence | EveryNDaysCadence;

export type CatalogItemStatus = "active" | "paused";

/**
 * A catalog (chore/routine) item.
 * `lastDone` is a Temporal.Instant (UTC). Calendar-day math uses required `zone`:
 * Instant → ZonedDateTimeISO(item.zone) → PlainDate → add cadence →
 * start-of-day Instant in that zone.
 */
export type CatalogItem = {
  readonly id: string;
  readonly name: string;
  readonly cadence: Cadence;
  /** Instant of last completion, or null if never done. */
  readonly lastDone: Temporal.Instant | null;
  /**
   * IANA time zone for day-boundary math (e.g. "Europe/Berlin").
   * Required — evaluate* uses only `item.zone` (no options fallback, no UTC default).
   */
  readonly zone: string;
  readonly status: CatalogItemStatus;
};

/**
 * Due triage state for one item at a point in time.
 * - overdue: next due local date is before today
 * - due: next due local date is today
 * - upcoming: next due is after today but within horizon
 * - not_applicable: paused, as_needed (already done once), or beyond horizon
 */
export type DueState = "due" | "overdue" | "upcoming" | "not_applicable";

export type EvaluatedItem = {
  readonly itemId: string;
  readonly state: DueState;
  /**
   * Next due Instant at start of the local due day in `item.zone`, or null when
   * state is not_applicable and no next date applies.
   */
  readonly nextDue: Temporal.Instant | null;
};

/**
 * Injectable clock — never call Temporal.Now / system time inside evaluate* for "now".
 * Tests pass a fixed clock; production injects system time.
 */
export type Clock = {
  now(): Temporal.Instant;
};

export type EvaluateOptions = {
  /**
   * How many calendar days ahead (from "today" in the item's zone) to treat
   * as "upcoming". Required — UX/adapters supply this; engine has no default.
   */
  readonly horizonDays: number;
};
