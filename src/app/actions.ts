"use server";

/**
 * App command edge. These actions mint ids (`crypto.randomUUID`) and read
 * `systemClock`. `markDone` and `insertCatalogItem` do not.
 */

import { revalidatePath } from "next/cache";

import { insertCatalogItem, markDone } from "@/adapters";
import { systemClock } from "@/time/system-clock";

import { getAppDb } from "./db";

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
 * Hand-enter one item. The submitted zone is stored as-is (the form prefills
 * `DEFAULT_ZONE`; this action does not invent a zone).
 */
export async function createCatalogItemAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = formString(formData, "name");
  const cadenceKind = formString(formData, "cadenceKind");
  const zone = formString(formData, "zone");
  if (name === null || cadenceKind === null || zone === null) {
    return { message: "Name, cadence, and zone are required." };
  }

  try {
    const db = await getAppDb();
    const id = crypto.randomUUID();
    await insertCatalogItem(db, {
      id,
      name,
      cadenceKind,
      zone,
      at: systemClock.now(),
    });
  } catch (err) {
    return { message: errorText(err) };
  }

  revalidatePath("/");
  return null;
}
