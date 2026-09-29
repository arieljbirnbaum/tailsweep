/**
 * Thin view models for the today/due list.
 *
 * Prefer Temporal.Instant in the VM; UI formats for display later.
 * No Date. No ISO coercion at this boundary unless a future UI adapter needs it.
 */

import type { CatalogItem } from "@/domain";
import type { DueState, EvaluatedItem } from "@/engine";
import type { Temporal } from "@/engine";

/** States shown on the today/due list (excludes paused / beyond-horizon / done as_needed). */
export const DUE_LIST_STATES = ["due", "overdue", "upcoming"] as const;

export type DueListState = (typeof DUE_LIST_STATES)[number];

export type DueListItemViewModel = {
  readonly id: string;
  readonly name: string;
  /** List triage state only (due | overdue | upcoming). */
  readonly state: DueListState;
  /**
   * Next due Instant at start of the local due day in the item’s zone, or null
   * when state is not_applicable. UI formats Instant → local string later.
   */
  readonly nextDue: Temporal.Instant | null;
};

export function isDueListState(state: DueState): state is DueListState {
  return (DUE_LIST_STATES as readonly string[]).includes(state);
}

/**
 * Map one catalog + evaluated pair to a due-list VM.
 * Fail-loud if evaluated.state is not a DueListState (caller should filter first).
 */
export function toDueListItemViewModel(
  item: CatalogItem,
  evaluated: EvaluatedItem,
): DueListItemViewModel {
  if (!isDueListState(evaluated.state)) {
    throw new TypeError(
      `toDueListItemViewModel: state must be one of ${DUE_LIST_STATES.join("|")}, got: ${evaluated.state}`,
    );
  }
  return {
    id: item.id,
    name: item.name,
    state: evaluated.state,
    nextDue: evaluated.nextDue,
  };
}

/**
 * Zip catalog + evaluate results into today/due list VMs.
 * Keeps input order; omits not_applicable (paused, beyond horizon, done as_needed).
 */
export function toDueListViewModels(
  items: readonly CatalogItem[],
  evaluated: readonly EvaluatedItem[],
): DueListItemViewModel[] {
  if (items.length !== evaluated.length) {
    throw new TypeError(
      `toDueListViewModels: items (${items.length}) and evaluated (${evaluated.length}) length mismatch`,
    );
  }
  const out: DueListItemViewModel[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const ev = evaluated[i]!;
    if (ev.itemId !== item.id) {
      throw new TypeError(
        `toDueListViewModels: evaluated[${i}].itemId (${ev.itemId}) !== items[${i}].id (${item.id})`,
      );
    }
    if (isDueListState(ev.state)) {
      out.push(toDueListItemViewModel(item, ev));
    }
  }
  return out;
}
