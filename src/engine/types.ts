/**
 * Pure domain types for Duekeep's completion-anchored due engine.
 * No UI / DB / IO / fetch / fs imports allowed in this module tree.
 */

/** Named cadence kinds (calendar-aligned). */
export type NamedCadenceKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "as_needed";

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
 * `lastDone` is an Instant (UTC ms). Calendar math uses required `zone`.
 */
export type CatalogItem = {
  readonly id: string;
  readonly name: string;
  readonly cadence: Cadence;
  /** Instant of last completion, or null if never done. */
  readonly lastDone: Date | null;
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
   * Next due instant (start of local due day in UTC), or null when
   * state is not_applicable and no next date applies.
   */
  readonly nextDue: Date | null;
};

/**
 * Injectable clock — never call `new Date()` inside evaluate* for "now".
 * Tests pass a fixed clock; production injects system time.
 */
export type Clock = {
  now(): Date;
};

export type EvaluateOptions = {
  /**
   * How many calendar days ahead (from "today" in the item's zone) to treat
   * as "upcoming". Required — UX/adapters supply this; engine has no default.
   */
  readonly horizonDays: number;
};
