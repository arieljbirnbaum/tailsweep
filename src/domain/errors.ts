/**
 * Typed domain parse errors. Fail loud at boundaries — never swallow.
 */

export class InvalidCadenceError extends Error {
  readonly code = "INVALID_CADENCE" as const;

  constructor(message: string) {
    super(`InvalidCadenceError: ${message}`);
    this.name = "InvalidCadenceError";
  }
}
