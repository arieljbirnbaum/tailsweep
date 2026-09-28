/**
 * Contract tests for the due-engine.
 *
 * These assert the BEHAVIOR Ariel must implement. evaluateItem currently
 * throws NotImplementedError — expect red until the engine is filled in.
 *
 * Run: pnpm test
 * Goal: make this file green without changing the assertions (unless the
 * product contract itself changes — then update ARCHITECTURE.md too).
 */

import { describe, expect, it } from "vitest";
import { evaluateItem, evaluateCatalog } from "./evaluate";
import { fixedClock } from "./clock";
import { InvalidDateError, NotImplementedError } from "./errors";
import type { CatalogItem, Cadence, DueState } from "./types";

const ZONE = "Europe/Berlin";
const HORIZON = 7;
const NOW = new Date("2026-09-27T12:00:00.000Z"); // Sun afternoon UTC ≈ Berlin CEST

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
  now?: Date;
  horizonDays?: number;
  wantState: DueState;
};

/**
 * Table-driven contract. Dates below are chosen so Europe/Berlin local
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
      lastDone: new Date("2026-09-01T10:00:00.000Z"),
      status: "paused",
    }),
    wantState: "not_applicable",
  },
  {
    name: "as_needed with prior completion → not_applicable",
    item: item({
      id: "as-needed-done",
      cadence: { kind: "as_needed" },
      lastDone: new Date("2026-01-01T10:00:00.000Z"),
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
      lastDone: new Date("2026-09-26T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "daily lastDone two days ago → overdue",
    item: item({
      id: "daily-old",
      cadence: { kind: "daily" },
      lastDone: new Date("2026-09-25T10:00:00.000Z"),
    }),
    wantState: "overdue",
  },
  {
    name: "daily lastDone today → upcoming (due tomorrow, within horizon)",
    item: item({
      id: "daily-today",
      cadence: { kind: "daily" },
      lastDone: new Date("2026-09-27T08:00:00.000Z"),
    }),
    wantState: "upcoming",
  },
  {
    name: "weekly lastDone 3 days ago → upcoming (due in 4 days)",
    item: item({
      id: "weekly-mid",
      cadence: { kind: "weekly" },
      lastDone: new Date("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "upcoming",
  },
  {
    name: "weekly lastDone 7 days ago → due",
    item: item({
      id: "weekly-due",
      cadence: { kind: "weekly" },
      lastDone: new Date("2026-09-20T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "weekly lastDone 10 days ago → overdue",
    item: item({
      id: "weekly-over",
      cadence: { kind: "weekly" },
      lastDone: new Date("2026-09-17T10:00:00.000Z"),
    }),
    wantState: "overdue",
  },
  {
    name: "every_n_days(3) lastDone 3 days ago → due",
    item: item({
      id: "n3-due",
      cadence: { kind: "every_n_days", days: 3 },
      lastDone: new Date("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "every_n_days(14) lastDone yesterday → beyond default horizon → not_applicable",
    item: item({
      id: "n14-far",
      cadence: { kind: "every_n_days", days: 14 },
      lastDone: new Date("2026-09-26T10:00:00.000Z"),
    }),
    horizonDays: 7,
    wantState: "not_applicable",
  },
  {
    name: "every_n_days(14) within extended horizon → upcoming",
    item: item({
      id: "n14-near",
      cadence: { kind: "every_n_days", days: 14 },
      lastDone: new Date("2026-09-26T10:00:00.000Z"),
    }),
    horizonDays: 20,
    wantState: "upcoming",
  },
  {
    name: "monthly lastDone same day last month → due",
    item: item({
      id: "monthly-due",
      cadence: { kind: "monthly" },
      lastDone: new Date("2026-08-27T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "yearly lastDone last year same calendar day → due",
    item: item({
      id: "yearly-due",
      cadence: { kind: "yearly" },
      lastDone: new Date("2025-09-27T10:00:00.000Z"),
    }),
    wantState: "due",
  },
  {
    name: "quarterly lastDone ~3 months ago → due",
    item: item({
      id: "quarterly-due",
      cadence: { kind: "quarterly" },
      lastDone: new Date("2026-06-27T10:00:00.000Z"),
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

  it("rejects non-Date now without coercion", () => {
    const bad = item({ id: "x", cadence: { kind: "daily" } });
    expect(() =>
      evaluateItem(bad, "2026-09-27" as unknown as Date, {
        horizonDays: HORIZON,
      }),
    ).toThrow(InvalidDateError);
  });

  it("rejects invalid lastDone Date", () => {
    const bad = item({
      id: "x",
      cadence: { kind: "daily" },
      lastDone: new Date("not-a-date"),
    });
    expect(() =>
      evaluateItem(bad, NOW, { horizonDays: HORIZON }),
    ).toThrow(InvalidDateError);
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

describe("stub status (handoff signal)", () => {
  it("evaluateItem still throws NotImplemented until Ariel lands logic", () => {
    // If this passes, stubs were replaced — great. If it fails because
    // implementation returns values, the contract tests above are the source of truth.
    // This test documents the scaffold state; skip once implemented.
    const sample = item({
      id: "stub-check",
      cadence: { kind: "daily" } satisfies Cadence,
      lastDone: new Date("2026-09-26T10:00:00.000Z"),
    });
    try {
      evaluateItem(sample, NOW, { horizonDays: HORIZON });
      // Implemented: no throw. Contract tests above must be green.
      expect(true).toBe(true);
    } catch (e) {
      expect(e).toBeInstanceOf(NotImplementedError);
    }
  });

  it("fixedClock freezes time", () => {
    const clock = fixedClock("2026-09-27T12:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-09-27T12:00:00.000Z");
  });
});
