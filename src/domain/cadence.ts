/**
 * Cadence schemas + parse helpers.
 * Source of truth for Cadence shape and constraints (positive every_n_days.days).
 * Branded opaque Cadence: invalid values cannot be built via parseCadence /
 * parseCadenceJson. Engine imports the branded type only; adapters/persistence
 * call parse* at the boundary. Do not invent a second factory pattern.
 */

import { z } from "zod";

import { InvalidCadenceError } from "./errors";

const NAMED_KINDS = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "as_needed",
] as const;

export const namedCadenceKindSchema = z.enum(NAMED_KINDS);

export type NamedCadenceKind = z.infer<typeof namedCadenceKindSchema>;

/** Internal named cadence: { kind } only — not a public construction door. */
const namedCadenceSchema = z
  .object({
    kind: namedCadenceKindSchema,
  })
  .strict();

/**
 * Fixed interval of N calendar days (completion-anchored).
 * `days` must be a positive integer (≥ 1).
 * Internal schema — construct Cadence via parseCadence only.
 */
const everyNDaysCadenceSchema = z
  .object({
    kind: z.literal("every_n_days"),
    days: z.number().int().positive(),
  })
  .strict();

/**
 * Branded Cadence — how often an item should be completed again after lastDone.
 * Named kinds use calendar periods in the item's zone; `every_n_days` adds a
 * fixed day count. Valid-by-construction via parseCadence / parseCadenceJson.
 * Plain literals are not assignable. ESLint blanket-bans type assertions
 * except `as const` / `<const>` (other escapes need a scoped carve-out;
 * never chained). The engine trusts branded inputs and does not re-validate.
 */
export const cadenceSchema = z
  .union([namedCadenceSchema, everyNDaysCadenceSchema])
  .brand<"Cadence">();

export type Cadence = z.infer<typeof cadenceSchema>;

/**
 * Stable human-readable InvalidCadenceError copy (not Zod's "Too small" /
 * "Invalid input"). Prefer prior hand-rolled messages from the mapper era.
 */
function cadenceFailureMessage(raw: unknown, source: "cadence" | "cadence_json"): string {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return source === "cadence_json"
      ? `cadence_json must be a JSON object, got ${typeof raw}`
      : `cadence must be a JSON object, got ${typeof raw}`;
  }

  // `in` narrowing — no type assertion (assertion allowlist is for edges only).
  const kind = "kind" in raw ? raw.kind : undefined;

  if (typeof kind !== "string") {
    return source === "cadence_json"
      ? "cadence_json.kind must be a string"
      : "cadence.kind must be a string";
  }

  if (kind === "every_n_days") {
    return "every_n_days requires positive integer days and no extra keys";
  }

  if (NAMED_KINDS.some((k) => k === kind)) {
    return `named cadence ${kind} must have only { kind }`;
  }

  return `unknown cadence kind: ${kind}`;
}

/** First actionable Zod issue (walks invalid_union branches). */
function firstZodIssue(issues: z.core.$ZodIssue[]): z.core.$ZodIssue | undefined {
  for (const issue of issues) {
    if (issue.code === "invalid_union") {
      for (const branch of issue.errors) {
        const leaf = firstZodIssue(branch);
        if (leaf) return leaf;
      }
      continue;
    }
    return issue;
  }
  return undefined;
}

/** Compact Zod detail: `path: message` (or prettify first line). */
function formatZodCompact(error: z.ZodError): string {
  const leaf = firstZodIssue(error.issues);
  if (leaf) {
    const path = leaf.path.length > 0 ? leaf.path.join(".") : "root";
    return `${path}: ${leaf.message}`;
  }
  const pretty = z.prettifyError(error);
  const firstLine = pretty
    .split("\n")
    .map((line) => line.replace(/^[✖x]\s*/u, "").trim())
    .find((line) => line.length > 0);
  return firstLine ?? "invalid input";
}

function invalidCadenceFromZod(
  raw: unknown,
  source: "cadence" | "cadence_json",
  error: z.ZodError,
): InvalidCadenceError {
  return new InvalidCadenceError(
    `${cadenceFailureMessage(raw, source)} (${formatZodCompact(error)})`,
  );
}

/**
 * Strict Cadence parse from unknown. Throws InvalidCadenceError on bad shape.
 * Returns branded Cadence — the public construction path.
 * No permissive coercions (string|object unions beyond the Cadence contract).
 */
export function parseCadence(raw: unknown): Cadence {
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw invalidCadenceFromZod(raw, "cadence", result.error);
  }
  return result.data;
}

/**
 * Strict Cadence JSON parse. Throws InvalidCadenceError on bad JSON or shape.
 */
export function parseCadenceJson(json: string): Cadence {
  let raw: unknown;
  try {
    // JSON.parse is `any`; assign into unknown without assertion.
    raw = JSON.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new InvalidCadenceError(`cadence_json is not valid JSON: ${message}`);
  }
  const result = cadenceSchema.safeParse(raw);
  if (!result.success) {
    throw invalidCadenceFromZod(raw, "cadence_json", result.error);
  }
  return result.data;
}

export function serializeCadence(cadence: Cadence): string {
  return JSON.stringify(cadence);
}
