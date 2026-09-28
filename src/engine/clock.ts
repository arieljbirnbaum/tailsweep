import type { Clock } from "./types";
import type { Temporal } from "./temporal";

/** Fixed clock for tests and deterministic replays. */
export function fixedClock(instant: Temporal.Instant): Clock {
  return {
    now(): Temporal.Instant {
      return instant;
    },
  };
}
