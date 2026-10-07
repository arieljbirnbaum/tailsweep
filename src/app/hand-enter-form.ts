/**
 * Hand-enter form schema, shared by the client (`onValidate`) and the server
 * action (authoritative parse).
 *
 * The form layer only *decodes* submitted strings into the raw domain shape
 * (`days` must be canonical decimal digits — no `Number()` / auto-coercion).
 * Every constraint — known kinds, positive safe-integer days, no stray keys,
 * zone, name — comes from the domain schemas it pipes into. Nothing here
 * restates a kind or a limit.
 *
 * Field names mirror the domain path (`cadence.kind`, `cadence.days`), so
 * domain issues land on the matching input without a mapping table.
 */

import { parseWithZod } from "@conform-to/zod/v4";
import { z } from "zod";

import { cadenceSchema, catalogItemNameSchema, zoneSchema } from "@/domain";

/** Canonical decimal digits → number. Range / integer checks are the domain's. */
const decimalDigits = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Days must be plain decimal digits, e.g. 14")
  .transform(Number);

/**
 * Raw cadence fields → domain `cadenceSchema`. Strict, so an unknown
 * `cadence.*` field fails instead of being dropped before the domain sees it.
 * The `unknown` hop hands the decoded shape to the domain as untrusted input.
 */
const cadenceFieldsSchema = z
  .strictObject({
    kind: z.string(),
    days: decimalDigits.optional(),
  })
  .transform((raw): unknown => raw)
  .pipe(cadenceSchema);

export const handEnterFormSchema = z.strictObject({
  name: catalogItemNameSchema,
  zone: zoneSchema,
  cadence: cadenceFieldsSchema,
});

/**
 * React reserves `$ACTION_*` for the hidden inputs it renders into
 * server-action forms for progressive enhancement (the SSR'd hand-enter form
 * carries `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`); they
 * ride along in the submitted FormData. They are framework plumbing, not form fields, so they
 * are removed before the strict parse. Nothing else is dropped.
 */
const REACT_ACTION_FIELD = /^\$ACTION_/;

function withoutReactActionFields(formData: FormData): FormData {
  const fields = new FormData();
  for (const [key, value] of formData.entries()) {
    if (!REACT_ACTION_FIELD.test(key)) fields.append(key, value);
  }
  return fields;
}

export function parseHandEnterForm(formData: FormData) {
  return parseWithZod(withoutReactActionFields(formData), {
    schema: handEnterFormSchema,
    disableAutoCoercion: true,
  });
}
