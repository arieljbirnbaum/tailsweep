/**
 * Behavioral tests for the due-engine.
 *
 * Prefer Instant.equals for nextDue — state-only rows miss SOD vs wall-clock bugs.
 *
 * Run: pnpm test
 */

import { describe, expect, it } from "vitest";
import { evaluateItem, evaluateCatalog } from "./evaluate";
import { Temporal } from "./temporal";
import type { CatalogItem, DueState } from "./types";

const ZONE = "Europe/Berlin";
const HORIZON = 7;
/** Sun afternoon UTC ≈ Berlin CEST (local calendar date 2026-09-27). */
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z");

function item(
  overrides: Partial<CatalogItem> & Pick<CatalogItem, "id" | "cadence">,
): CatalogItem {
  return {
    name: overrides.name ?? overrides.id,
    lastDone: overrides.lastDone ?? null,
    zone: overrides.zone ?? ZONE,
    status: overrides.status ?? "active",
    ...overrides,
  };
}

/** Start-of-day Instant for `instant`'s local calendar date in `zone`. */
function startOfLocalDay(
  instant: Temporal.Instant,
  zone: string = ZONE,
): Temporal.Instant {
  return instant.toZonedDateTimeISO(zone).startOfDay().toInstant();
}

/** Start-of-day Instant for a PlainDate (YYYY-MM-DD) in zone. */
function sod(plainDate: string, zone: string = ZONE): Temporal.Instant {
  return Temporal.PlainDate.from(plainDate)
    .toZonedDateTime({ timeZone: zone, plainTime: "00:00" })
    .toInstant();
}

type Case = {
  name: string;
  item: CatalogItem;
  now?: Temporal.Instant;
  horizonDays?: number;
  wantState: DueState;
  /**
   * When set: assert Instant.equals (or null).
   * Omit only for rows that intentionally skip nextDue (prefer not to).
   */
  wantNextDue: Temporal.Instant | null;
};

const TODAY_SOD = startOfLocalDay(NOW);

/**
 * Table-driven contract. Instants chosen so Europe/Berlin local dates are
 * unambiguous (midday UTC → afternoon CEST).
 */
const cases: Case[] = [
  {
    name: "paused is always not_applicable with null nextDue",
    item: item({
      id: "paused-daily",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-01T10:00:00.000Z"),
      status: "paused",
    }),
    wantState: "not_applicable",
    wantNextDue: null,
  },
  {
    name: "as_needed with prior completion → not_applicable, null nextDue",
    item: item({
      id: "as-needed-done",
      cadence: { kind: "as_needed" },
      lastDone: Temporal.Instant.from("2026-01-01T10:00:00.000Z"),
    }),
    wantState: "not_applicable",
    wantNextDue: null,
  },
  {
    name: "as_needed never done → due; nextDue = today SOD",
    item: item({
      id: "as-needed-new",
      cadence: { kind: "as_needed" },
      lastDone: null,
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily never done → overdue; nextDue = today SOD (not wall-clock now)",
    item: item({
      id: "daily-new",
      cadence: { kind: "daily" },
      lastDone: null,
    }),
    wantState: "overdue",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily lastDone yesterday → due today; nextDue = today SOD",
    item: item({
      id: "daily-yday",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily lastDone two days ago → overdue; nextDue = that due day's SOD",
    item: item({
      id: "daily-old",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-25T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-26"),
  },
  {
    name: "daily lastDone today → upcoming tomorrow within horizon",
    item: item({
      id: "daily-today",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-27T08:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-09-28"),
  },
  {
    name: "weekly lastDone 3 days ago → upcoming (due in 4 days)",
    item: item({
      id: "weekly-mid",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-10-01"),
  },
  {
    name: "weekly lastDone 7 days ago → due",
    item: item({
      id: "weekly-due",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-20T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "weekly lastDone 10 days ago → overdue",
    item: item({
      id: "weekly-over",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-17T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-24"),
  },
  {
    name: "every_n_days(3) lastDone 3 days ago → due",
    item: item({
      id: "n3-due",
      cadence: { kind: "every_n_days", days: 3 },
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "every_n_days(14) beyond horizon 7 → not_applicable",
    item: item({
      id: "n14-far",
      cadence: { kind: "every_n_days", days: 14 },
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    horizonDays: 7,
    wantState: "not_applicable",
    // Still a concrete due Instant; state is beyond horizon.
    wantNextDue: sod("2026-10-10"),
  },
  {
    name: "every_n_days(14) within extended horizon → upcoming",
    item: item({
      id: "n14-near",
      cadence: { kind: "every_n_days", days: 14 },
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    horizonDays: 20,
    wantState: "upcoming",
    wantNextDue: sod("2026-10-10"),
  },
  {
    name: "horizon inclusive: nextDue local date === today+horizon → upcoming",
    item: item({
      id: "horizon-eq",
      cadence: { kind: "every_n_days", days: 7 },
      // lastDone local 2026-09-27 → next 2026-10-04 === today+7
      lastDone: Temporal.Instant.from("2026-09-27T08:00:00.000Z"),
    }),
    horizonDays: 7,
    wantState: "upcoming",
    wantNextDue: sod("2026-10-04"),
  },
  {
    name: "horizon exclusive beyond: nextDue === today+horizon+1 → not_applicable",
    item: item({
      id: "horizon-gt",
      cadence: { kind: "every_n_days", days: 8 },
      lastDone: Temporal.Instant.from("2026-09-27T08:00:00.000Z"),
    }),
    horizonDays: 7,
    wantState: "not_applicable",
    wantNextDue: sod("2026-10-05"),
  },
  {
    name: "monthly lastDone same day last month → due",
    item: item({
      id: "monthly-due",
      cadence: { kind: "monthly" },
      lastDone: Temporal.Instant.from("2026-08-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "yearly lastDone last year same calendar day → due",
    item: item({
      id: "yearly-due",
      cadence: { kind: "yearly" },
      lastDone: Temporal.Instant.from("2025-09-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "quarterly lastDone ~3 months ago → due",
    item: item({
      id: "quarterly-due",
      cadence: { kind: "quarterly" },
      lastDone: Temporal.Instant.from("2026-06-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
];

describe("evaluateItem contract", () => {
  it.each(cases)("$name", (c) => {
    const result = evaluateItem(c.item, c.now ?? NOW, {
      horizonDays: c.horizonDays ?? HORIZON,
    });
    expect(result.itemId).toBe(c.item.id);
    expect(result.state).toBe(c.wantState);
    if (c.wantNextDue === null) {
      expect(result.nextDue).toBeNull();
    } else {
      expect(result.nextDue).not.toBeNull();
      expect(result.nextDue!.equals(c.wantNextDue)).toBe(true);
      // Wall-clock midday must never be returned as nextDue.
      expect(result.nextDue!.equals(c.now ?? NOW)).toBe(false);
    }
  });
});

describe("evaluateCatalog contract", () => {
  it("preserves input order and maps each item", () => {
    const items: CatalogItem[] = [
      item({
        id: "a",
        cadence: { kind: "daily" },
        status: "paused",
      }),
      item({
        id: "b",
        cadence: { kind: "as_needed" },
        lastDone: null,
      }),
    ];
    const results = evaluateCatalog(items, NOW, { horizonDays: HORIZON });
    expect(results.map((r) => r.itemId)).toEqual(["a", "b"]);
    expect(results[0]?.state).toBe("not_applicable");
    expect(results[0]?.nextDue).toBeNull();
    expect(results[1]?.state).toBe("due");
  });
});
