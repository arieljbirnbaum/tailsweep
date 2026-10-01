/**
 * Engine types — domain typedefs re-exported as the single source of truth,
 * plus evaluate-only types (DueState, Clock, EvaluatedItem).
 *
 * Domain owns branded Cadence / EvaluateOptions / CatalogItem constraints (Zod).
 * Engine logic stays pure and type-only-imports from domain — no Zod runtime
 * parse on evaluate*. Adapters construct via domain parse* factories.
 */

import type { Temporal } from "./temporal";

export type {
  Cadence,
  NamedCadence,
  NamedCadenceKind,
  EveryNDaysCadence,
  CatalogItem,
  CatalogItemStatus,
  EvaluateOptions,
} from "@/domain";

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
