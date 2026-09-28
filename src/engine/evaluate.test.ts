/**
 * Contract tests for the due-engine.
 *
 * Assert state and nextDue against ARCHITECTURE.md. Prefer Instant.equals
 * checks for nextDue — state-only rows will miss wall-clock vs start-of-day bugs.
 *
 * Run: pnpm test
 */

import { describe, expect, it } from "vitest";
import { evaluateItem, evaluateCatalog } from "./evaluate";
import { fixedClock } from "./clock";
import { Temporal } from "./temporal";
import type { CatalogItem, DueState } from "./types";

const ZONE = "Europe/Berlin";
const HORIZON = 7;
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z"); // Sun afternoon UTC ≈ Berlin CEST

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

type Case = {
  name: string;
  item: CatalogItem;
  now?: Temporal.Instant;
  horizonDays?: number;
  wantState: DueState;
};

/**
 * Table-driven contract. Instants below are chosen so Europe/Berlin local
 * calendar dates are unambiguous (midday UTC → afternoon CEST).
 *
 * Semantics (must match ARCHITECTURE.md):
 * - Paused → not_applicable
 * - as_needed + lastDone → not_applicable; never done → due
 * - Never done (scheduled cadence) → overdue
 * - nextDue local date vs today: before=overdue, same=due, after within horizon=upcoming, beyond=not_applicable
 * - daily: next = lastDone local date + 1 day
 * - weekly: +7 days; monthly: +1 calendar month; quarterly: +3 months; yearly: +1 year
 * - every_n_days: +N days from lastDone local date
 */
const cases: Case[] = [
  {
    name: "paused is always not_applicable",
    item: item({
      id: "paused-daily",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-01T10:00:00.000Z"),
      status: "paused",
    }),
    wantState: "not_applicable",
  },
  {
    name: "as_needed with prior completion → not_applicable",
    item: item({
      id: "as-needed-done",
      cadence: { kind: "as_needed" },
      lastDone: Temporal.Instant.from("2026-01-01T10:00:00.000Z"),
    }),
    wantState: "not_applicable",
  },
  {
    name: "as_needed never done → due",
    item: item({
      id: "as-needed-new",
      cadence: { kind: "as_needed" },
      lastDone: null,
    }),
    wantState: "due",
  },
  {
    name: "daily never done → overdue",
    item: item({
      id: "daily-new",
      cadence: { kind: "daily" },
      lastDone: null,
    }),
    wantState: "overdue",
  },
  {
    name: "daily lastDone yesterday → due today",
    item: item({
      id: "daily-yday",
      cadence: { kind: "daily" },
      // 2026-09-26 local Berlin
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "daily lastDone two days ago → overdue",
    item: item({
      id: "daily-old",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-25T10:00:00.000Z"),
    }),
    wantState: "overdue",
  },
  {
    name: "daily lastDone today → upcoming (due tomorrow, within horizon)",
    item: item({
      id: "daily-today",
      cadence: { kind: "daily" },
      lastDone: Temporal.Instant.from("2026-09-27T08:00:00.000Z"),
    }),
    wantState: "upcoming",
  },
  {
    name: "weekly lastDone 3 days ago → upcoming (due in 4 days)",
    item: item({
      id: "weekly-mid",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "upcoming",
  },
  {
    name: "weekly lastDone 7 days ago → due",
    item: item({
      id: "weekly-due",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-20T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "weekly lastDone 10 days ago → overdue",
    item: item({
      id: "weekly-over",
      cadence: { kind: "weekly" },
      lastDone: Temporal.Instant.from("2026-09-17T10:00:00.000Z"),
    }),
    wantState: "overdue",
  },
  {
    name: "every_n_days(3) lastDone 3 days ago → due",
    item: item({
      id: "n3-due",
      cadence: { kind: "every_n_days", days: 3 },
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "every_n_days(14) lastDone yesterday → beyond default horizon → not_applicable",
    item: item({
      id: "n14-far",
      cadence: { kind: "every_n_days", days: 14 },
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    horizonDays: 7,
    wantState: "not_applicable",
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
  },
  {
    name: "monthly lastDone same day last month → due",
    item: item({
      id: "monthly-due",
      cadence: { kind: "monthly" },
      lastDone: Temporal.Instant.from("2026-08-27T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "yearly lastDone last year same calendar day → due",
    item: item({
      id: "yearly-due",
      cadence: { kind: "yearly" },
      lastDone: Temporal.Instant.from("2025-09-27T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "quarterly lastDone ~3 months ago → due",
    item: item({
      id: "quarterly-due",
      cadence: { kind: "quarterly" },
      lastDone: Temporal.Instant.from("2026-06-27T10:00:00.000Z"),
    }),
    wantState: "due",
  },
];

describe("evaluateItem contract", () => {
  it.each(cases)("$name", (c) => {
    const result = evaluateItem(c.item, c.now ?? NOW, {
      horizonDays: c.horizonDays ?? HORIZON,
    });
    expect(result.itemId).toBe(c.item.id);
    expect(result.state).toBe(c.wantState);
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
    expect(results[1]?.state).toBe("due");
  });
});

describe("evaluateItem nextDue contract", () => {
  const todayStart = NOW.toZonedDateTimeISO(ZONE).startOfDay().toInstant();

  it("scheduled never done → nextDue is start of today in zone (not wall-clock now)", () => {
    const result = evaluateItem(
      item({
        id: "daily-new-nextdue",
        cadence: { kind: "daily" },
        lastDone: null,
      }),
      NOW,
      { horizonDays: HORIZON },
    );
    expect(result.state).toBe("overdue");
    expect(result.nextDue).not.toBeNull();
    expect(result.nextDue!.equals(todayStart)).toBe(true);
    // Wall-clock now is midday UTC; nextDue must be local midnight Instant, not `now`.
    expect(result.nextDue!.equals(NOW)).toBe(false);
  });

  it("as_needed never done → nextDue is start of today in zone", () => {
    const result = evaluateItem(
      item({
        id: "as-needed-new-nextdue",
        cadence: { kind: "as_needed" },
        lastDone: null,
      }),
      NOW,
      { horizonDays: HORIZON },
    );
    expect(result.state).toBe("due");
    expect(result.nextDue).not.toBeNull();
    expect(result.nextDue!.equals(todayStart)).toBe(true);
  });

  it("daily lastDone yesterday → nextDue is start of today in zone", () => {
    const result = evaluateItem(
      item({
        id: "daily-yday-nextdue",
        cadence: { kind: "daily" },
        lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
      }),
      NOW,
      { horizonDays: HORIZON },
    );
    expect(result.state).toBe("due");
    expect(result.nextDue).not.toBeNull();
    expect(result.nextDue!.equals(todayStart)).toBe(true);
  });
});

describe("fixedClock", () => {
  it("freezes Instant", () => {
    const instant = Temporal.Instant.from("2026-09-27T12:00:00.000Z");
    const clock = fixedClock(instant);
    const a = clock.now();
    const b = clock.now();
    expect(a.equals(instant)).toBe(true);
    expect(a.equals(b)).toBe(true);
  });
});
