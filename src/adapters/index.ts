/**
 * App adapters — sit outside the engine.
 *
 * Load persistence → evaluate* with injectable Clock → thin view models.
 * UX defaults (horizon, default zone) live here only; never in src/engine.
 */

export { DEFAULT_HORIZON_DAYS, DEFAULT_ZONE } from "./defaults";
export { loadCatalog, loadCompletions } from "./load-catalog";
export { loadAndEvaluate } from "./load-and-evaluate";
export type { LoadAndEvaluateOptions, LoadAndEvaluateResult } from "./load-and-evaluate";
export {
  DUE_LIST_STATES,
  toDueListItemViewModel,
  toDueListViewModels,
} from "./view-models";
export type { DueListItemViewModel, DueListState } from "./view-models";
