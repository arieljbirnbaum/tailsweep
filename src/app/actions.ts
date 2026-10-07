"use server";

/**
 * App command edge. These actions mint ids (`crypto.randomUUID`) and read
 * `systemClock`. `markDone` and `insertCatalogItem` do not.
 */

import { revalidatePath } from "next/cache";

import { insertCatalogItem, markDone } from "@/adapters";
import { namedCadenceKindSchema, type CadenceInput } from "@/domain";
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

/**
 * Form strings → CadenceInput. Fail loud on unknown kind, every_n_days without
 * a positive integer days, or days sent with a named kind.
 */
function cadenceInputFromForm(
  cadenceKind: string,
  daysRaw: string | null,
): CadenceInput | { readonly message: string } {
  if (cadenceKind === "every_n_days") {
    if (daysRaw === null || daysRaw.length === 0) {
      return {
        message:
          "Days is required for every_n_days (e.g. 14 for every two weeks).",
      };
    }
    const days = Number(daysRaw);
    if (!Number.isInteger(days) || days < 1) {
      return { message: "Days must be a positive integer." };
    }
    return { kind: "every_n_days", days };
  }

  const named = namedCadenceKindSchema.safeParse(cadenceKind);
  if (!named.success) {
    return { message: `Unknown cadence kind: ${cadenceKind}` };
  }
  if (daysRaw !== null && daysRaw.length > 0) {
    return {
      message: `days is only valid with every_n_days; got cadenceKind "${cadenceKind}"`,
    };
  }
  return { kind: named.data };
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
  const daysRaw = formString(formData, "days");
  if (name === null || cadenceKind === null || zone === null) {
    return { message: "Name, cadence, and zone are required." };
  }

  const cadenceOrError = cadenceInputFromForm(cadenceKind, daysRaw);
  if ("message" in cadenceOrError) {
    return { message: cadenceOrError.message };
  }

  try {
    const db = await getAppDb();
    const id = crypto.randomUUID();
    await insertCatalogItem(db, {
      id,
      name,
      cadence: cadenceOrError,
      zone,
      at: systemClock.now(),
    });
  } catch (err) {
    return { message: errorText(err) };
  }

  revalidatePath("/");
  return null;
}
