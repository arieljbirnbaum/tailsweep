/**
 * Typed errors for the pure due-engine.
 * Never swallow these — callers should surface them for debuggability.
 */

export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;

  constructor(feature: string) {
    super(
      `NotImplementedError: ${feature} — Ariel: implement this in the due-engine until tests are green.`,
    );
    this.name = "NotImplementedError";
  }
}

export class InvalidDateError extends Error {
  readonly code = "INVALID_DATE" as const;

  constructor(label: string, value: unknown) {
    super(
      `InvalidDateError: ${label} is not a valid Date (got ${String(value)}). No silent date coercion.`,
    );
    this.name = "InvalidDateError";
  }
}

export class InvalidCadenceError extends Error {
  readonly code = "INVALID_CADENCE" as const;

  constructor(message: string) {
    super(`InvalidCadenceError: ${message}`);
    this.name = "InvalidCadenceError";
  }
}
