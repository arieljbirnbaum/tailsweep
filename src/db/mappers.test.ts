/**
 * Table-driven mapper round-trips and strict parse failures.
 */

import { describe, expect, it } from "vitest";

import { parseCadence } from "@/domain";
import { InvalidCadenceError } from "@/engine/errors";
import { Temporal } from "@/engine/temporal";
import type { Cadence, CatalogItem } from "@/engine/types";

import {
  catalogItemToRow,
  completionToRow,
  parseCadenceJson,
  rowToCatalogItem,
  rowToCompletion,
  serializeCadence,
  type Completion,
} from "./mappers";

const CREATED = Temporal.Instant.from("2026-09-01T08:00:00.000Z");
const UPDATED = Temporal.Instant.from("2026-09-15T12:00:00.000Z");
const LAST_DONE = Temporal.Instant.from("2026-09-20T10:00:00.000Z");
const COMPLETED_AT = Temporal.Instant.from("2026-09-20T10:00:00.000Z");

type CatalogRoundTripCase = {
  name: string;
  item: CatalogItem;
};

const catalogCases: CatalogRoundTripCase[] = [
  {
    name: "daily active with lastDone",
    item: {
      id: "chore-1",
      name: "Water plants",
      cadence: parseCadence({ kind: "daily" }),
      lastDone: LAST_DONE,
      zone: "Europe/Berlin",
      status: "active",
    },
  },
  {
    name: "weekly paused never done",
    item: {
      id: "chore-2",
      name: "Vacuum",
      cadence: parseCadence({ kind: "weekly" }),
      lastDone: null,
      zone: "America/Los_Angeles",
      status: "paused",
    },
  },
  {
    name: "every_n_days(3)",
    item: {
      id: "chore-3",
      name: "Change filter",
      cadence: parseCadence({ kind: "every_n_days", days: 3 }),
      lastDone: LAST_DONE,
      zone: "Europe/Berlin",
      status: "active",
    },
  },
  {
    name: "as_needed",
    item: {
      id: "chore-4",
      name: "Clean oven",
      cadence: parseCadence({ kind: "as_needed" }),
      lastDone: null,
      zone: "Europe/Berlin",
      status: "active",
    },
  },
  {
    name: "yearly",
    item: {
      id: "chore-5",
      name: "Smoke alarm batteries",
      cadence: parseCadence({ kind: "yearly" }),
      lastDone: LAST_DONE,
      zone: "Europe/Berlin",
      status: "active",
    },
  },
];

describe("catalogItem ↔ row round-trip", () => {
  it.each(catalogCases)("$name", ({ item }) => {
    const row = catalogItemToRow(item, {
      createdAt: CREATED,
      updatedAt: UPDATED,
    });
    const back = rowToCatalogItem(row);

    expect(back.id).toBe(item.id);
    expect(back.name).toBe(item.name);
    expect(back.cadence).toEqual(item.cadence);
    expect(back.zone).toBe(item.zone);
    expect(back.status).toBe(item.status);

    if (item.lastDone === null) {
      expect(back.lastDone).toBeNull();
    } else {
      expect(back.lastDone).not.toBeNull();
      expect(Temporal.Instant.compare(back.lastDone!, item.lastDone)).toBe(0);
      expect(back.lastDone!.equals(item.lastDone)).toBe(true);
    }

    expect(row.createdAt).toBe(CREATED.toString());
    expect(row.updatedAt).toBe(UPDATED.toString());
    expect(row.zone).toBe(item.zone);
  });
});

describe("completion ↔ row round-trip", () => {
  it("maps Instant and optional note", () => {
    const completion: Completion = {
      id: "c1",
      itemId: "chore-1",
      completedAt: COMPLETED_AT,
      note: "done early",
    };
    const row = completionToRow(completion);
    const back = rowToCompletion(row);

    expect(back.id).toBe(completion.id);
    expect(back.itemId).toBe(completion.itemId);
    expect(back.note).toBe("done early");
    expect(back.completedAt.equals(COMPLETED_AT)).toBe(true);
  });

  it("maps null note", () => {
    const completion: Completion = {
      id: "c2",
      itemId: "chore-1",
      completedAt: COMPLETED_AT,
      note: null,
    };
    const back = rowToCompletion(completionToRow(completion));
    expect(back.note).toBeNull();
    expect(back.completedAt.equals(COMPLETED_AT)).toBe(true);
  });
});

describe("parseCadenceJson (strict)", () => {
  const good: { name: string; json: string; want: Cadence }[] = [
    {
      name: "daily",
      json: '{"kind":"daily"}',
      want: parseCadence({ kind: "daily" }),
    },
    {
      name: "every_n_days",
      json: '{"kind":"every_n_days","days":7}',
      want: parseCadence({ kind: "every_n_days", days: 7 }),
    },
  ];

  it.each(good)("$name", ({ json, want }) => {
    expect(parseCadenceJson(json)).toEqual(want);
    expect(serializeCadence(want)).toBe(JSON.stringify(want));
  });

  const bad: { name: string; json: string }[] = [
    { name: "not json", json: "daily" },
    { name: "array", json: "[]" },
    { name: "null", json: "null" },
    { name: "missing kind", json: "{}" },
    { name: "unknown kind", json: '{"kind":"hourly"}' },
    { name: "named with extra key", json: '{"kind":"daily","days":1}' },
    { name: "every_n_days without days", json: '{"kind":"every_n_days"}' },
    {
      name: "every_n_days zero days",
      json: '{"kind":"every_n_days","days":0}',
    },
    {
      name: "every_n_days float days",
      json: '{"kind":"every_n_days","days":1.5}',
    },
  ];

  it.each(bad)("rejects $name", ({ json }) => {
    expect(() => parseCadenceJson(json)).toThrow(InvalidCadenceError);
  });
});

describe("strict zone / status (no silent defaults)", () => {
  it("rowToCatalogItem rejects empty zone", () => {
    const row = catalogItemToRow(
      {
        id: "x",
        name: "x",
        cadence: parseCadence({ kind: "daily" }),
        lastDone: null,
        zone: "Europe/Berlin",
        status: "active",
      },
      { createdAt: CREATED, updatedAt: UPDATED },
    );
    expect(() => rowToCatalogItem({ ...row, zone: "" })).toThrow(/zone is required/);
  });

  it("rowToCatalogItem rejects bad status", () => {
    const row = catalogItemToRow(
      {
        id: "x",
        name: "x",
        cadence: parseCadence({ kind: "daily" }),
        lastDone: null,
        zone: "Europe/Berlin",
        status: "active",
      },
      { createdAt: CREATED, updatedAt: UPDATED },
    );
    // Intentional invalid status: @ts-expect-error avoids forging via `as`.
    expect(() =>
      // @ts-expect-error archived is not a CatalogItemRow status
      rowToCatalogItem({ ...row, status: "archived" }),
    ).toThrow(/status must be active\|paused/);
  });

  it("rowToCatalogItem rejects bad Instant ISO", () => {
    const row = catalogItemToRow(
      {
        id: "x",
        name: "x",
        cadence: parseCadence({ kind: "daily" }),
        lastDone: LAST_DONE,
        zone: "Europe/Berlin",
        status: "active",
      },
      { createdAt: CREATED, updatedAt: UPDATED },
    );
    expect(() => rowToCatalogItem({ ...row, lastDoneAt: "not-an-instant" })).toThrow();
  });
});
