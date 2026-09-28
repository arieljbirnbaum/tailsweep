/**
 * Temporal namespace for the pure due-engine.
 *
 * Box/Node 20–22 and many browsers lack native Temporal. Node 26+ ships it.
 * This module re-exports the Stage-4-shaped API from `@js-temporal/polyfill`
 * so engine code imports `{ Temporal }` from here (never assume a global).
 *
 * The polyfill does not patch `globalThis.Temporal`; that avoids masking a
 * real implementation when one is present.
 */
export { Temporal } from "@js-temporal/polyfill";
