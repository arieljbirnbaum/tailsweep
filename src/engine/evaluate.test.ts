/**
 * Behavioral tests for the due-engine.
 *
 * Prefer Instant.equals for nextDue — state-only rows miss SOD vs wall-clock bugs.
 *
 * Run: pnpm test
 */

import { describe, expect, it } from "vitest";
import { parseCadence } from "@/domain/cadence";
import { parseEvaluateOptions } from "@/domain/evaluate-options";
import { evaluateItem, evaluateCatalog } from "./evaluate";
import { Temporal } from "./temporal";
import type { Cadence, CatalogItem, DueState, EvaluateOptions } from "./types";

const ZONE = "Europe/Berlin";
const HORIZON = 7;
/** Sun afternoon UTC ≈ Berlin CEST (local calendar date 2026-09-27). */
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z");

/** Domain factory — branded Cadence (tests must not use bare literals). */
function cadence(raw: unknown): Cadence {
  return parseCadence(raw);
}

/** Domain factory — branded EvaluateOptions. */
function options(horizonDays: number): EvaluateOptions {
  return parseEvaluateOptions({ horizonDays });
}


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
      cadence: cadence({ kind: "daily" }),
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
      cadence: cadence({ kind: "as_needed" }),
      lastDone: Temporal.Instant.from("2026-01-01T10:00:00.000Z"),
    }),
    wantState: "not_applicable",
    wantNextDue: null,
  },
  {
    name: "as_needed never done → due; nextDue = today SOD",
    item: item({
      id: "as-needed-new",
      cadence: cadence({ kind: "as_needed" }),
      lastDone: null,
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily never done → overdue; nextDue = today SOD (not wall-clock now)",
    item: item({
      id: "daily-new",
      cadence: cadence({ kind: "daily" }),
      lastDone: null,
    }),
    wantState: "overdue",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily lastDone yesterday → due today; nextDue = today SOD",
    item: item({
      id: "daily-yday",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "daily lastDone two days ago → overdue; nextDue = that due day's SOD",
    item: item({
      id: "daily-old",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-09-25T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-26"),
  },
  {
    name: "daily lastDone today → upcoming tomorrow within horizon",
    item: item({
      id: "daily-today",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-09-27T08:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-09-28"),
  },
  {
    name: "weekly lastDone 3 days ago → upcoming (due in 4 days)",
    item: item({
      id: "weekly-mid",
      cadence: cadence({ kind: "weekly" }),
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-10-01"),
  },
  {
    name: "weekly lastDone 7 days ago → due",
    item: item({
      id: "weekly-due",
      cadence: cadence({ kind: "weekly" }),
      lastDone: Temporal.Instant.from("2026-09-20T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "weekly lastDone 10 days ago → overdue",
    item: item({
      id: "weekly-over",
      cadence: cadence({ kind: "weekly" }),
      lastDone: Temporal.Instant.from("2026-09-17T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-24"),
  },
  {
    name: "every_n_days(3) lastDone 3 days ago → due",
    item: item({
      id: "n3-due",
      cadence: cadence({ kind: "every_n_days", days: 3 }),
      lastDone: Temporal.Instant.from("2026-09-24T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "every_n_days(14) beyond horizon 7 → not_applicable",
    item: item({
      id: "n14-far",
      cadence: cadence({ kind: "every_n_days", days: 14 }),
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
      cadence: cadence({ kind: "every_n_days", days: 14 }),
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
      cadence: cadence({ kind: "every_n_days", days: 7 }),
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
      cadence: cadence({ kind: "every_n_days", days: 8 }),
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
      cadence: cadence({ kind: "monthly" }),
      lastDone: Temporal.Instant.from("2026-08-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "yearly lastDone last year same calendar day → due",
    item: item({
      id: "yearly-due",
      cadence: cadence({ kind: "yearly" }),
      lastDone: Temporal.Instant.from("2025-09-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "quarterly lastDone ~3 months ago → due",
    item: item({
      id: "quarterly-due",
      cadence: cadence({ kind: "quarterly" }),
      lastDone: Temporal.Instant.from("2026-06-27T10:00:00.000Z"),
    }),
    wantState: "due",
    wantNextDue: TODAY_SOD,
  },
  {
    name: "monthly lastDone such that next is yesterday → overdue",
    item: item({
      id: "monthly-over",
      cadence: cadence({ kind: "monthly" }),
      lastDone: Temporal.Instant.from("2026-08-26T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-26"),
  },
  {
    name: "monthly lastDone such that next is in a few days within horizon → upcoming",
    item: item({
      id: "monthly-upcoming",
      cadence: cadence({ kind: "monthly" }),
      lastDone: Temporal.Instant.from("2026-08-30T10:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-09-30"),
  },
  {
    name: "quarterly lastDone such that next is yesterday → overdue",
    item: item({
      id: "quarterly-over",
      cadence: cadence({ kind: "quarterly" }),
      lastDone: Temporal.Instant.from("2026-06-26T10:00:00.000Z"),
    }),
    wantState: "overdue",
    wantNextDue: sod("2026-09-26"),
  },
  {
    name: "yearly lastDone such that next is in a few days within horizon → upcoming",
    item: item({
      id: "yearly-upcoming",
      cadence: cadence({ kind: "yearly" }),
      lastDone: Temporal.Instant.from("2025-09-30T10:00:00.000Z"),
    }),
    wantState: "upcoming",
    wantNextDue: sod("2026-09-30"),
  },
  // --- Month-end / leap overflow (Temporal constrain intent) ---
  {
    name: "month-end overflow: Jan 31 + monthly → Feb 28 SOD (constrain)",
    item: item({
      id: "monthly-jan31",
      cadence: cadence({ kind: "monthly" }),
      lastDone: Temporal.Instant.from("2026-01-31T12:00:00.000Z"),
    }),
    now: Temporal.Instant.from("2026-02-28T12:00:00.000Z"),
    wantState: "due",
    wantNextDue: sod("2026-02-28"),
  },
  {
    name: "month-end overflow: Jan 31 + monthly → Feb 29 SOD in leap year (constrain)",
    item: item({
      id: "monthly-jan31-leap",
      cadence: cadence({ kind: "monthly" }),
      lastDone: Temporal.Instant.from("2024-01-31T12:00:00.000Z"),
    }),
    now: Temporal.Instant.from("2024-02-29T12:00:00.000Z"),
    wantState: "due",
    wantNextDue: sod("2024-02-29"),
  },
  {
    name: "leap overflow: Feb 29 + yearly → Feb 28 SOD in non-leap year (constrain)",
    item: item({
      id: "yearly-feb29",
      cadence: cadence({ kind: "yearly" }),
      lastDone: Temporal.Instant.from("2024-02-29T12:00:00.000Z"),
    }),
    now: Temporal.Instant.from("2025-02-28T12:00:00.000Z"),
    wantState: "due",
    wantNextDue: sod("2025-02-28"),
  },
  // --- DST lock-in (Europe/Berlin): spring gap / fall fold SOD Instants ---
  {
    name: "DST spring: daily across Berlin spring-forward → due; nextDue = local 2026-03-29 SOD (CEST)",
    item: item({
      id: "dst-spring-daily",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-03-28T12:00:00.000Z"),
      zone: "Europe/Berlin",
    }),
    now: Temporal.Instant.from("2026-03-29T12:00:00.000Z"),
    wantState: "due",
    // Verified via polyfill: local midnight 2026-03-29 Berlin = 2026-03-28T23:00:00Z
    wantNextDue: sod("2026-03-29", "Europe/Berlin"),
  },
  {
    name: "DST fall: daily across Berlin fall-back → due; nextDue = local 2026-10-25 SOD (CET)",
    item: item({
      id: "dst-fall-daily",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-10-24T12:00:00.000Z"),
      zone: "Europe/Berlin",
    }),
    now: Temporal.Instant.from("2026-10-25T12:00:00.000Z"),
    wantState: "due",
    // Verified via polyfill: local midnight 2026-10-25 Berlin = 2026-10-24T22:00:00Z
    wantNextDue: sod("2026-10-25", "Europe/Berlin"),
  },
  // --- Zone diversity ---
  {
    name: "America/Los_Angeles daily lastDone yesterday → due; nextDue = LA SOD (not Berlin)",
    item: item({
      id: "la-daily-due",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-09-26T19:00:00.000Z"),
      zone: "America/Los_Angeles",
    }),
    now: Temporal.Instant.from("2026-09-27T19:00:00.000Z"),
    wantState: "due",
    // LA local 2026-09-27 midnight PDT = 2026-09-27T07:00:00Z (≠ Berlin SOD)
    wantNextDue: sod("2026-09-27", "America/Los_Angeles"),
  },
  {
    name: "civil-date split: near-UTC-midnight Instant — Berlin local date ≠ UTC date → due with Berlin SOD",
    item: item({
      id: "civil-split-berlin",
      cadence: cadence({ kind: "daily" }),
      // lastDone local Berlin 2026-09-27 → next = Berlin 2026-09-28 SOD
      lastDone: Temporal.Instant.from("2026-09-27T12:00:00.000Z"),
      zone: "Europe/Berlin",
    }),
    // 2026-09-28T01:00Z = Berlin 03:00 Sep 28 / LA 18:00 Sep 27 — Berlin date ≠ UTC date
    now: Temporal.Instant.from("2026-09-28T01:00:00.000Z"),
    wantState: "due",
    wantNextDue: sod("2026-09-28", "Europe/Berlin"),
  },
  {
    name: "civil-date split: same Instant under LA — still Sep 27 locally → upcoming (next = LA Sep 28 SOD)",
    item: item({
      id: "civil-split-la",
      cadence: cadence({ kind: "daily" }),
      lastDone: Temporal.Instant.from("2026-09-27T12:00:00.000Z"),
      zone: "America/Los_Angeles",
    }),
    now: Temporal.Instant.from("2026-09-28T01:00:00.000Z"),
    wantState: "upcoming",
    wantNextDue: sod("2026-09-28", "America/Los_Angeles"),
  },
];

describe("evaluateItem contract", () => {
  it.each(cases)("$name", (c) => {
    const result = evaluateItem(
      c.item,
      c.now ?? NOW,
      options(c.horizonDays ?? HORIZON),
    );
    expect(result.itemId).toBe(c.item.id);
    expect(result.state).toBe(c.wantState);
    if (c.wantNextDue === null) {
      expect(result.nextDue).toBeNull();
    } else {
      expect(result.nextDue).not.toBeNull();
      expect(result.nextDue!.equals(c.wantNextDue)).toBe(true);
    }
  });
});

describe("evaluateCatalog contract", () => {
  it("preserves input order and maps each item", () => {
    const items: CatalogItem[] = [
      item({
        id: "a",
        cadence: cadence({ kind: "daily" }),
        status: "paused",
      }),
      item({
        id: "b",
        cadence: cadence({ kind: "as_needed" }),
        lastDone: null,
      }),
      item({
        id: "c",
        cadence: cadence({ kind: "daily" }),
        lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
      }),
    ];
    const results = evaluateCatalog(items, NOW, options(HORIZON));
    expect(results.map((r) => r.itemId)).toEqual(["a", "b", "c"]);
    expect(results[0]?.state).toBe("not_applicable");
    expect(results[0]?.nextDue).toBeNull();
    expect(results[1]?.state).toBe("due");
    expect(results[1]?.nextDue).not.toBeNull();
    expect(results[1]!.nextDue!.equals(TODAY_SOD)).toBe(true);
    expect(results[2]?.state).toBe("due");
    expect(results[2]?.nextDue).not.toBeNull();
    expect(results[2]!.nextDue!.equals(TODAY_SOD)).toBe(true);
  });

  it("empty catalog → empty results", () => {
    expect(evaluateCatalog([], NOW, options(HORIZON))).toEqual([]);
  });
});
