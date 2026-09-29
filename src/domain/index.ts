/**
 * Duekeep domain layer — Zod schemas + constrained types + fail-loud parsers.
 *
 * Engine depends on typedefs from here (type-only on the evaluate happy path).
 * Adapters / persistence call parse* helpers at the boundary.
 * Do not import Zod into evaluate* for runtime parse on every call.
 */

export { Temporal } from "./temporal";

export { InvalidCadenceError } from "./errors";

export {
  namedCadenceKindSchema,
  namedCadenceSchema,
  everyNDaysCadenceSchema,
  cadenceSchema,
  parseCadence,
  parseCadenceJson,
  serializeCadence,
} from "./cadence";
export type {
  NamedCadenceKind,
  NamedCadence,
  EveryNDaysCadence,
  Cadence,
} from "./cadence";

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
