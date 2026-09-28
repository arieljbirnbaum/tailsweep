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
 * Accepts a Temporal.Instant or an ISO Instant string (`Temporal.Instant.from`).
 * Instants are immutable — `now()` returns the same frozen Instant each call.
 * Bad Instant strings: `Temporal.Instant.from` throws (TypeError / RangeError).
 */
export function fixedClock(input: Temporal.Instant | string): Clock {
  const frozen =
    typeof input === "string" ? Temporal.Instant.from(input) : input;
  return {
    now(): Temporal.Instant {
      return frozen;
    },
  };
}
