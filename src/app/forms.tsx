"use client";

import { useActionState, useState } from "react";

import { createCatalogItemAction, markDoneAction } from "./actions";

const fieldClass =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** Native <select> popups often keep a light OS menu while inheriting page text color. */
const selectClass = `${fieldClass} [color-scheme:light]`;

export function MarkDoneForm({ itemId }: { itemId: string }) {
  const [error, formAction, pending] = useActionState(markDoneAction, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
      >
        Mark done
      </button>
      {error ? (
        <p
          role="alert"
          className="max-w-48 text-right text-xs text-red-700 dark:text-red-400"
        >
          {error.message}
        </p>
      ) : null}
    </form>
  );
}

export function HandEnterForm({
  defaultZone,
  cadenceKinds,
}: {
  defaultZone: string;
  cadenceKinds: readonly string[];
}) {
  const [error, formAction, pending] = useActionState(createCatalogItemAction, null);
  const [cadenceKind, setCadenceKind] = useState("daily");
  const kinds = [...cadenceKinds, "every_n_days"];

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Add item</h2>
      <label className="text-sm">
        Name
        <input name="name" required className={fieldClass} />
      </label>
      <label className="text-sm">
        Cadence
        <select
          name="cadenceKind"
          value={cadenceKind}
          onChange={(event) => setCadenceKind(event.target.value)}
          className={selectClass}
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      {cadenceKind === "every_n_days" ? (
        <label className="text-sm">
          Days
          <input
            name="days"
            type="number"
            required
            min={1}
            step={1}
            defaultValue={14}
            className={fieldClass}
          />
        </label>
      ) : null}
      <label className="text-sm">
        Zone
        <input
          name="zone"
          required
          defaultValue={defaultZone}
          className={fieldClass}
          autoComplete="off"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
      >
        Add
      </button>
    </form>
  );
}
