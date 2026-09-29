/**
 * One clear app → engine call path:
 *   load catalog from Db → evaluateCatalog(now, { horizonDays }) → due-list VMs.
 *
 * No permissive coercions (no string|Instant, no optional zone on evaluate).
 * Horizon default is adapter-owned (`DEFAULT_HORIZON_DAYS`); engine still gets
 * branded EvaluateOptions via `evaluateOptions({ horizonDays })` on every call.
 */

import { evaluateOptions, type CatalogItem } from "@/domain";
import type { Db } from "@/db";
import { evaluateCatalog, type Clock, type EvaluatedItem, type Temporal } from "@/engine";

import { DEFAULT_HORIZON_DAYS } from "./defaults";
import { loadCatalog } from "./load-catalog";
import { toDueListViewModels, type DueListItemViewModel } from "./view-models";

export type LoadAndEvaluateOptions = {
  /** Injectable clock — `fixedClock` in tests, `systemClock` in prod. */
  readonly clock: Clock;
  /**
   * Days ahead for “upcoming”. When omitted, adapters apply
   * {@link DEFAULT_HORIZON_DAYS} explicitly when building EvaluateOptions.
   * The engine never sees an undefined horizon.
   */
  readonly horizonDays?: number;
};

export type LoadAndEvaluateResult = {
  readonly catalog: CatalogItem[];
  readonly evaluated: EvaluatedItem[];
  /** Today/due list VMs (due | overdue | upcoming only). */
  readonly dueList: DueListItemViewModel[];
  readonly now: Temporal.Instant;
  /** Horizon actually passed to evaluate* (after adapter default). */
  readonly horizonDays: number;
};

/**
 * Load catalog from persistence, evaluate with injectable clock + horizon,
 * map to thin due-list view models.
 */
export async function loadAndEvaluate(
  db: Db,
  options: LoadAndEvaluateOptions,
): Promise<LoadAndEvaluateResult> {
  const catalog = await loadCatalog(db);
  // Adapter-owned default — explicit constant, not a silent engine fallback.
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const now = options.clock.now();
  const evaluated = evaluateCatalog(
    catalog,
    now,
    evaluateOptions({ horizonDays }),
  );
  const dueList = toDueListViewModels(catalog, evaluated);
  return { catalog, evaluated, dueList, now, horizonDays };
}
