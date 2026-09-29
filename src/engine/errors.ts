/**
 * Typed errors for the pure due-engine.
 * Never swallow these — callers should surface them for debuggability.
 *
 * InvalidCadenceError lives in domain (parse boundary); re-exported here for
 * stable `@/engine` consumers.
 */

export { InvalidCadenceError } from "@/domain";

export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;

  constructor(feature: string) {
    super(
      `NotImplementedError: ${feature} — Ariel: implement this in the due-engine until tests are green.`,
    );
    this.name = "NotImplementedError";
  }
}
