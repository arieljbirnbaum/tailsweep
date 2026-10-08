"use client";

import { useForm } from "@conform-to/react";
import { useActionState, useState, type ReactNode } from "react";

import { CADENCE_KINDS, type CadenceKind } from "@/domain";

import { createCatalogItemAction, markDoneAction } from "./actions";
import type { CadenceFormDefaults } from "./hand-enter-cadence";
import { parseHandEnterForm } from "./hand-enter-form";

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

/** Error list under one field (Conform field errors or form-level errors). */
function FieldErrors({ id, errors }: { id: string; errors: readonly string[] | undefined }) {
  if (errors === undefined || errors.length === 0) return null;
  return (
    <ul id={id} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

/** Conform metadata the per-kind inputs need: the submitted name and its errors. */
type ArgField = {
  readonly id: string;
  readonly name: string;
  readonly errorId: string;
  readonly errors: readonly string[] | undefined;
};

type CadenceArgFields = { readonly days: ArgField };

function EveryNDaysArgs({ defaultDays, field }: { defaultDays: number; field: ArgField }) {
  return (
    <div className="text-sm">
      <label htmlFor={field.id}>Days</label>
      <input
        id={field.id}
        name={field.name}
        inputMode="numeric"
        defaultValue={String(defaultDays)}
        aria-invalid={field.errors ? true : undefined}
        aria-describedby={field.errors ? field.errorId : undefined}
        className={fieldClass}
      />
      <FieldErrors id={field.errorId} errors={field.errors} />
    </div>
  );
}

/**
 * Per-kind argument inputs, keyed on the domain kind union: a new domain kind
 * fails typecheck until it has an entry here. No-argument kinds render no inputs.
 */
const CADENCE_ARGS_INPUTS: {
  readonly [K in CadenceKind]: (
    defaults: CadenceFormDefaults[K],
    fields: CadenceArgFields,
  ) => ReactNode;
} = {
  daily: () => null,
  weekly: () => null,
  monthly: () => null,
  quarterly: () => null,
  yearly: () => null,
  as_needed: () => null,
  every_n_days: (defaults, fields) => (
    <EveryNDaysArgs defaultDays={defaults.days} field={fields.days} />
  ),
};

function renderCadenceArgs<K extends CadenceKind>(
  kind: K,
  defaults: CadenceFormDefaults,
  fields: CadenceArgFields,
): ReactNode {
  const render: (d: CadenceFormDefaults[K], f: CadenceArgFields) => ReactNode =
    CADENCE_ARGS_INPUTS[kind];
  return render(defaults[kind], fields);
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
  const [lastResult, formAction, pending] = useActionState(createCatalogItemAction, null);
  const [form, fields] = useForm({
    lastResult,
    onValidate({ formData }) {
      return parseHandEnterForm(formData);
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });
  const cadence = fields.cadence.getFieldset();
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>(CADENCE_KINDS[0]);

  return (
    <form
      id={form.id}
      onSubmit={form.onSubmit}
      action={formAction}
      noValidate
      className="flex flex-col gap-3"
    >
      <h2 className="text-lg font-medium">Add item</h2>
      <div className="text-sm">
        <label htmlFor={fields.name.id}>Name</label>
        <input
          id={fields.name.id}
          name={fields.name.name}
          aria-invalid={fields.name.errors ? true : undefined}
          aria-describedby={fields.name.errors ? fields.name.errorId : undefined}
          className={fieldClass}
        />
        <FieldErrors id={fields.name.errorId} errors={fields.name.errors} />
      </div>
      <div className="text-sm">
        <label htmlFor={cadence.kind.id}>Cadence</label>
        <select
          id={cadence.kind.id}
          name={cadence.kind.name}
          value={cadenceKind}
          onChange={(event) => {
            setCadenceKind(toCadenceKind(event.target.value));
          }}
          aria-invalid={cadence.kind.errors ? true : undefined}
          aria-describedby={cadence.kind.errors ? cadence.kind.errorId : undefined}
          className={selectClass}
        >
          {CADENCE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <FieldErrors id={cadence.kind.errorId} errors={cadence.kind.errors} />
        {/* Whole-cadence issues (e.g. an argument the kind doesn't take). */}
        <FieldErrors id={fields.cadence.errorId} errors={fields.cadence.errors} />
      </div>
      {renderCadenceArgs(cadenceKind, cadenceDefaults, { days: cadence.days })}
      <div className="text-sm">
        <label htmlFor={fields.zone.id}>Zone</label>
        <input
          id={fields.zone.id}
          name={fields.zone.name}
          defaultValue={defaultZone}
          autoComplete="off"
          aria-invalid={fields.zone.errors ? true : undefined}
          aria-describedby={fields.zone.errors ? fields.zone.errorId : undefined}
          className={fieldClass}
        />
        <FieldErrors id={fields.zone.errorId} errors={fields.zone.errors} />
      </div>
      <FieldErrors id={form.errorId} errors={form.errors} />
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
