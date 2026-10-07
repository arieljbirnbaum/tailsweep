/**
 * Hand-enter cadence options for the dogfood UI.
 *
 * The form renders whatever is listed here. It does not invent missing kinds
 * or hard-code argument defaults — those live on each option.
 */

import { namedCadenceKindSchema, type NamedCadenceKind } from "@/domain";

export type NamedCadenceFormOption = {
  readonly kind: NamedCadenceKind;
};

export type EveryNDaysCadenceFormOption = {
  readonly kind: "every_n_days";
  /** Prefill for the Days field (e.g. 14 = every two weeks). */
  readonly defaultDays: number;
};

export type CadenceFormOption =
  | NamedCadenceFormOption
  | EveryNDaysCadenceFormOption;

const NAMED_OPTIONS: readonly NamedCadenceFormOption[] =
  namedCadenceKindSchema.options.map((kind) => ({ kind }));

/** Full set offered by the hand-enter form, including every_n_days. */
export const HAND_ENTER_CADENCE_OPTIONS: readonly CadenceFormOption[] = [
  ...NAMED_OPTIONS,
  { kind: "every_n_days", defaultDays: 14 },
];

export function cadenceFormOption(
  options: readonly CadenceFormOption[],
  kind: string,
): CadenceFormOption | undefined {
  for (const option of options) {
    if (option.kind === kind) return option;
  }
  return undefined;
}
