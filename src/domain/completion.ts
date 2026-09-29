/**
 * Completion log fact type + parse helper.
 */

import { z } from "zod";

import { instantToIso, parseInstant } from "./instant";
import type { Temporal } from "./temporal";

/** Domain view of a completion log row (facts only). */
export type Completion = {
  readonly id: string;
  readonly itemId: string;
  readonly completedAt: Temporal.Instant;
  readonly note: string | null;
};

export function parseCompletion(input: {
  id: unknown;
  itemId: unknown;
  completedAt: unknown;
  note: unknown;
}): Completion {
  return {
    id: z.string().min(1).parse(input.id),
    itemId: z.string().min(1).parse(input.itemId),
    completedAt: parseInstant(input.completedAt),
    note:
      input.note === null || input.note === undefined
        ? null
        : z.string().parse(input.note),
  };
}

export function completionCompletedAtToIso(completedAt: Temporal.Instant): string {
  return instantToIso(completedAt);
}
