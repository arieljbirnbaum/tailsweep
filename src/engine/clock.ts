import type { Clock } from "./types";
import { Temporal } from "./temporal";

/** System clock. Prefer injecting this at the adapter edge, not inside engine math. */
export const systemClock: Clock = {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  },
};

/**
 * Fixed clock for tests and deterministic replays.
 * Callers pass a Temporal.Instant (parse ISO strings at the call site).
 * Instants are immutable — `now()` returns the same frozen Instant each call.
 */
export function fixedClock(instant: Temporal.Instant): Clock {
  return {
    now(): Temporal.Instant {
      return instant;
    },
  };
}
