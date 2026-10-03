/**
 * Fact path: the displayed day is the Instant's civil date in the item zone.
 * Europe/Berlin in early October is CEST (UTC+2), so a UTC evening is the next local day.
 * Not a CSS snapshot.
 */

import { describe, expect, it } from "vitest";

import { Temporal } from "@/engine";

import { formatCivilDate } from "./civil-date";

describe("formatCivilDate", () => {
  it("formats a known Instant as the Europe/Berlin civil date, not the UTC date", () => {
    // 2026-10-03 is before the EU DST fall-back (last Sunday of October 2026).
    // 22:30Z is 00:30 the next calendar day in Europe/Berlin.
    const instant = Temporal.Instant.from("2026-10-02T22:30:00.000Z");

    expect(formatCivilDate(instant, "Europe/Berlin")).toBe("2026-10-03");
    expect(formatCivilDate(instant, "UTC")).toBe("2026-10-02");
  });

  it("formats a Europe/Berlin start-of-day Instant as that local day", () => {
    const sod = Temporal.Instant.from("2026-10-02T22:30:00.000Z")
      .toZonedDateTimeISO("Europe/Berlin")
      .startOfDay()
      .toInstant();

    expect(sod.toZonedDateTimeISO("UTC").toPlainDate().toString()).toBe("2026-10-02");
    expect(formatCivilDate(sod, "Europe/Berlin")).toBe("2026-10-03");
  });
});
