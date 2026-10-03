/**
 * App adapters — sit outside the engine.
 *
 * Load persistence → evaluate* with injectable Clock → thin view models.
 * markDone writes completion + lastDone (no due math).
 * UX defaults (horizon, default zone) live here only; never in src/engine.
 */

export { DEFAULT_HORIZON_DAYS, DEFAULT_ZONE } from "./defaults";
export { loadCatalog, loadCompletions } from "./load-catalog";
export { loadAndEvaluate } from "./load-and-evaluate";
export type { LoadAndEvaluateOptions, LoadAndEvaluateResult } from "./load-and-evaluate";
export { markDone } from "./mark-done";
export type { MarkDoneInput } from "./mark-done";
export { CatalogItemNotFoundError } from "./errors";
export {
  DUE_LIST_STATES,
  isDueListState,
  toDueListItemViewModel,
  toDueListViewModels,
} from "./view-models";
export type { DueListItemViewModel, DueListState } from "./view-models";
