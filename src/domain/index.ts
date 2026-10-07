/**
 * Duekeep domain layer — Zod schemas + constrained / branded types +
 * factories (typed) and fail-loud parsers (unknown / JSON boundaries).
 *
 * Prefer `cadence` / `evaluateOptions` for in-app construction; parse* right after deserialization.
 * Engine depends on typedefs from here (type-only on the evaluate happy path).
 * Adapters / persistence call `cadence` / `evaluateOptions` or parse* at the boundary (valid-by-construction).
 * Do not import Zod into evaluate* for runtime parse on every call.
 */

export { Temporal } from "./temporal";

export { InvalidCadenceError } from "./errors";

export {
  CADENCE_KINDS,
  cadenceSchema,
  cadence,
  parseCadence,
  parseCadenceJson,
  serializeCadence,
} from "./cadence";
export type {
  CadenceKind,
  Cadence,
  CadenceInput,
} from "./cadence";

export {
  evaluateOptionsSchema,
  evaluateOptions,
  parseEvaluateOptions,
} from "./evaluate-options";
export type {
  EvaluateOptions,
  EvaluateOptionsInput,
} from "./evaluate-options";

export {
  instantIsoSchema,
  parseInstantIso,
  parseNullableInstantIso,
  parseInstant,
  instantToIso,
} from "./instant";

export {
  catalogItemStatusSchema,
  catalogItemNameSchema,
  zoneSchema,
  catalogItemWireSchema,
  parseZone,
  parseCatalogItemStatus,
  parseCatalogItem,
  parseCatalogItemFromRow,
  lastDoneToIso,
} from "./catalog";
export type { CatalogItemStatus, CatalogItemWire, CatalogItem } from "./catalog";

export { parseCompletion, completionCompletedAtToIso } from "./completion";
export type { Completion } from "./completion";
