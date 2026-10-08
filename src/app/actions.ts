"use server";

/**
 * App command edge. These actions mint ids (`crypto.randomUUID`) and read
 * `systemClock`. `markDone` and `insertCatalogItem` do not.
 */

import type { SubmissionResult } from "@conform-to/zod/v4";
import { revalidatePath } from "next/cache";

import { insertCatalogItem, markDone } from "@/adapters";
import { systemClock } from "@/time/system-clock";

import { getAppDb } from "./db";
import { parseHandEnterForm } from "./hand-enter-form";

type ActionResult = { readonly message: string } | null;

function errorText(err: unknown): string {
  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }
  return String(err);
}

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  return value;
}

/** One click, one completion id. `completedAt` is `systemClock.now()` here. */
export async function markDoneAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const itemId = formString(formData, "itemId");
  if (itemId === null || itemId.length === 0) {
    return { message: "Missing item id." };
  }

  try {
    const db = await getAppDb();
    const completionId = crypto.randomUUID();
    const completedAt = systemClock.now();
    await markDone(db, { itemId, completedAt, completionId });
  } catch (err) {
    return { message: errorText(err) };
  }

  revalidatePath("/");
  return null;
}

/**
 * Hand-enter one item. Validation is `parseHandEnterForm` (the same schema the
 * client runs); failures come back as per-field errors. Adapter / DB failures
 * come back as form-level errors. The submitted zone is stored as-is (the form
 * prefills `DEFAULT_ZONE`; this action does not invent one).
 */
export async function createCatalogItemAction(
  _previous: SubmissionResult<string[]> | null,
  formData: FormData,
): Promise<SubmissionResult<string[]>> {
  const submission = parseHandEnterForm(formData);
  if (submission.status !== "success") {
    return submission.reply();
  }

  const { name, zone, cadence } = submission.value;
  try {
    const db = await getAppDb();
    await insertCatalogItem(db, {
      id: crypto.randomUUID(),
      name,
      cadence,
      zone,
      at: systemClock.now(),
    });
  } catch (err) {
    return submission.reply({ formErrors: [errorText(err)] });
  }

  revalidatePath("/");
  return submission.reply({ resetForm: true });
}
