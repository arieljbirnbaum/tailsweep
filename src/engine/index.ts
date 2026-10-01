/**
 * Duekeep due-engine — pure TypeScript.
 *
 * HARD RULE: this package/folder must never import Next.js, React, Drizzle,
 * fs, fetch, or any I/O. Adapters live under src/db and UI under src/app.
 */

export { Temporal } from "./temporal";

export type {
  Cadence,
  NamedCadenceKind,
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
