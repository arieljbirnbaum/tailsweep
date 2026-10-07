"use client";

import { useActionState, useState, type ReactNode } from "react";

import { CADENCE_KINDS, type CadenceKind } from "@/domain";

import { createCatalogItemAction, markDoneAction } from "./actions";
import type { CadenceFormDefaults } from "./hand-enter-cadence";

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

function EveryNDaysArgs({ defaultDays }: { defaultDays: number }) {
  return (
    <label className="text-sm">
      Days
      <input
        name="days"
        type="number"
        required
        min={1}
        step={1}
        defaultValue={defaultDays}
        className={fieldClass}
      />
    </label>
  );
}

/**
 * Per-kind argument inputs, keyed on the domain kind union: a new domain kind
 * fails typecheck until it has an entry here. Named kinds have no inputs.
 */
const CADENCE_ARGS_INPUTS: {
  readonly [K in CadenceKind]: (defaults: CadenceFormDefaults[K]) => ReactNode;
} = {
  daily: () => null,
  weekly: () => null,
  monthly: () => null,
  quarterly: () => null,
  yearly: () => null,
  as_needed: () => null,
  every_n_days: (defaults) => <EveryNDaysArgs defaultDays={defaults.days} />,
};

function renderCadenceArgs<K extends CadenceKind>(
  kind: K,
  defaults: CadenceFormDefaults,
): ReactNode {
  const render: (d: CadenceFormDefaults[K]) => ReactNode = CADENCE_ARGS_INPUTS[kind];
  return render(defaults[kind]);
}

function toCadenceKind(raw: string): CadenceKind {
  const kind = CADENCE_KINDS.find((k) => k === raw);
  if (kind === undefined) {
    throw new Error(`Unknown cadence kind from <select>: ${raw}`);
  }
  return kind;
}

export function HandEnterForm({
  defaultZone,
  cadenceDefaults,
}: {
  defaultZone: string;
  /** Per-kind argument defaults; the page supplies the config. */
  cadenceDefaults: CadenceFormDefaults;
}) {
  const [error, formAction, pending] = useActionState(createCatalogItemAction, null);
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>(CADENCE_KINDS[0]);

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
          onChange={(event) => {
            setCadenceKind(toCadenceKind(event.target.value));
          }}
          className={selectClass}
        >
          {CADENCE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      {renderCadenceArgs(cadenceKind, cadenceDefaults)}
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
