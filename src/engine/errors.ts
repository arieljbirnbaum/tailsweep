/**
 * Typed errors for the pure due-engine.
 * Never swallow these — callers should surface them for debuggability.
 *
 * InvalidCadenceError lives in `@/domain/errors` (thin, no Zod); re-exported
 * here for stable `@/engine` consumers. Do not value-import the fat `@/domain` barrel.
 */

export { InvalidCadenceError } from "@/domain/errors";

/**
 * Reserved for future stubs. evaluate* is implemented and does not throw this.
 */
export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;

  constructor(feature: string) {
    super(`NotImplementedError: ${feature} is not implemented`);
    this.name = "NotImplementedError";
  }
}
