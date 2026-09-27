import type { Clock } from "./types";
import { InvalidDateError } from "./errors";

/** System clock. Prefer injecting this at the adapter edge, not inside engine math. */
export const systemClock: Clock = {
  now(): Date {
    return new Date();
  },
};

/** Fixed clock for tests and deterministic replays. */
export function fixedClock(isoOrDate: string | Date): Clock {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) {
    throw new InvalidDateError("fixedClock", isoOrDate);
  }
  const frozen = new Date(d.getTime());
  return {
    now(): Date {
      return new Date(frozen.getTime());
    },
  };
}

/** Assert a value is a real Date (no silent coercion of strings/numbers). */
export function assertDate(label: string, value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidDateError(label, value);
  }
}
