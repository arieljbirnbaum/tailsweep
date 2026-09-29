/**
 * Dogfood / UX convenience defaults.
 *
 * These live ONLY in adapters — never in `src/engine`. The engine requires
 * `horizonDays` on every evaluate* call and has no zone/horizon defaults.
 * Callers that want the dogfood values pass them explicitly (or rely on
 * `loadAndEvaluate` applying `DEFAULT_HORIZON_DAYS` when `horizonDays` is omitted).
 */

/** How far ahead “upcoming” extends for the dogfood today/due list. */
export const DEFAULT_HORIZON_DAYS = 7;

/**
 * Default IANA zone for new catalog items in dogfood UX (create forms, seed).
 * Not applied by evaluate* — each CatalogItem already carries required `zone`.
 */
export const DEFAULT_ZONE = "Europe/Berlin";
