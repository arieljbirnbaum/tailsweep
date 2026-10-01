/**
 * Duekeep domain layer — Zod schemas + constrained / branded types + fail-loud parsers.
 *
 * Engine depends on typedefs from here (type-only on the evaluate happy path).
 * Adapters / persistence call parse* helpers at the boundary (valid-by-construction).
 * Do not import Zod into evaluate* for runtime parse on every call.
 */

export { Temporal } from "./temporal";

export { InvalidCadenceError } from "./errors";

export {
  namedCadenceKindSchema,
  cadenceSchema,
  parseCadence,
  parseCadenceJson,
  serializeCadence,
} from "./cadence";
export type {
  NamedCadenceKind,
  Cadence,
} from "./cadence";

export { evaluateOptionsSchema, parseEvaluateOptions } from "./evaluate-options";
export type { EvaluateOptions } from "./evaluate-options";

export {
  instantIsoSchema,
  parseInstantIso,
  parseNullableInstantIso,
  parseInstant,
  instantToIso,
} from "./instant";

export {
  catalogItemStatusSchema,
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
