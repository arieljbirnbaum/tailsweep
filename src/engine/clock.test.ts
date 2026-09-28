import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";
import { Temporal } from "./temporal";

describe("fixedClock", () => {
  it("freezes Instant (equals across calls; identity not asserted)", () => {
    const instant = Temporal.Instant.from("2026-09-27T12:00:00.000Z");
    const clock = fixedClock(instant);
    const a = clock.now();
    const b = clock.now();
    expect(a.equals(instant)).toBe(true);
    expect(a.equals(b)).toBe(true);
  });
});
