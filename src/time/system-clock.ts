import { Temporal, type Clock } from "@/engine";

/** Production system clock — inject at the adapter/UI edge, never inside engine math. */
export const systemClock: Clock = {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  },
};
