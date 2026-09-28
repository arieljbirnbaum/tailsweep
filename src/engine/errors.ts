/**
 * Typed errors for the pure due-engine.
 * Never swallow these — callers should surface them for debuggability.
 *
 * Invalid Instant / zone strings: let Temporal construction throw
 * (TypeError / RangeError). Adapters own input validation; the engine does
 * not wrap those into a custom InvalidDateError.
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

export class InvalidCadenceError extends Error {
  readonly code = "INVALID_CADENCE" as const;

  constructor(message: string) {
    super(`InvalidCadenceError: ${message}`);
    this.name = "InvalidCadenceError";
  }
}
