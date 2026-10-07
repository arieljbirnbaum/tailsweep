/**
 * Hand-enter cadence config for the dogfood UI: per-kind argument defaults.
 *
 * Keyed on the domain `CadenceKind` union, and each entry's shape is derived
 * from the domain `CadenceInput` variant for that kind. Omitting a kind, or
 * giving a kind an argument the domain doesn't define, fails typecheck.
 * The form renders `CADENCE_KINDS` (domain) — it cannot drop or invent kinds.
 */

import type { CadenceInput, CadenceKind } from "@/domain";

/** Argument fields of one cadence kind (named kinds: none). */
export type CadenceArgsOf<K extends CadenceKind> = Omit<
  Extract<CadenceInput, { kind: K }>,
  "kind"
>;

export type CadenceFormDefaults = {
  readonly [K in CadenceKind]: CadenceArgsOf<K>;
};

export const HAND_ENTER_CADENCE_DEFAULTS: CadenceFormDefaults = {
  daily: {},
  weekly: {},
  monthly: {},
  quarterly: {},
  yearly: {},
  as_needed: {},
  /** 14 = every two weeks. */
  every_n_days: { days: 14 },
};
