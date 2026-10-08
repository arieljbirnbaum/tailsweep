/**
 * Tailsweep due-engine — pure TypeScript.
 *
 * HARD RULE: this package/folder must never import Next.js, React, Drizzle,
 * fs, fetch, or any I/O. App adapters live under src/adapters; persistence
 * under src/db; UI under src/app.
 */

export { Temporal } from "./temporal";

export type {
  Cadence,
  CatalogItem,
  CatalogItemStatus,
  DueState,
  EvaluatedItem,
  Clock,
  EvaluateOptions,
} from "./types";

export { NotImplementedError, InvalidCadenceError } from "./errors";

export { fixedClock } from "./clock";

export { evaluateItem, evaluateCatalog } from "./evaluate";
