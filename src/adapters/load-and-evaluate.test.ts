/**
 * Frozen clock through adapter → known evaluate outcomes.
 * Temp SQLite + mappers (shared cleanup: @/db/test-temp-db).
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigrations,
  catalogItemToRow,
  catalogItems,
  createDb,
  type Db,
} from "@/db";
import { closeClients, removeTempDirs } from "@/db/test-temp-db";
import { InvalidCadenceError } from "@/domain";
import { fixedClock, Temporal } from "@/engine";

import { DEFAULT_HORIZON_DAYS, DEFAULT_ZONE } from "./defaults";
import { loadAndEvaluate } from "./load-and-evaluate";
import { loadCatalog, loadCompletions } from "./load-catalog";
import { toDueListViewModels } from "./view-models";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const ZONE = "Europe/Berlin";
/** Sun afternoon UTC ≈ Berlin CEST (local calendar date 2026-09-27). */
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z");
const CREATED = Temporal.Instant.from("2026-09-01T08:00:00.000Z");
const UPDATED = Temporal.Instant.from("2026-09-15T12:00:00.000Z");
const CREATED_ISO = CREATED.toString();
const UPDATED_ISO = UPDATED.toString();

function startOfLocalDay(
  instant: Temporal.Instant,
  zone: string = ZONE,
): Temporal.Instant {
  return instant.toZonedDateTimeISO(zone).startOfDay().toInstant();
}

const TODAY_SOD = startOfLocalDay(NOW);

describe("adapters loadAndEvaluate", () => {
  const tempDirs: string[] = [];
  const openDbs: Db[] = [];

  afterEach(async () => {
    await closeClients(openDbs);
    await removeTempDirs(tempDirs, "load-and-evaluate.test");
  });

  async function openTempDb(): Promise<Db> {
    const dir = mkdtempSync(path.join(tmpdir(), "duekeep-ail-30-"));
    tempDirs.push(dir);
    const db = createDb(`file:${path.join(dir, "test.db")}`);
    openDbs.push(db);
    await applyMigrations(db, MIGRATIONS_FOLDER);
    return db;
  }

  it("frozen clock drives evaluate through the adapter to known outcomes", async () => {
    const db = await openTempDb();

    const fixtures = [
      {
        id: "daily-yday",
        name: "Water plants",
        cadence: { kind: "daily" as const },
        lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
        zone: ZONE,
        status: "active" as const,
      },
      {
        id: "daily-new",
        name: "Take trash out",
        cadence: { kind: "daily" as const },
        lastDone: null,
        zone: ZONE,
        status: "active" as const,
      },
      {
        id: "weekly-upcoming",
        name: "Vacuum",
        cadence: { kind: "weekly" as const },
        // lastDone 2026-09-22 → next due 2026-09-29 (within horizon 7 from 09-27)
        lastDone: Temporal.Instant.from("2026-09-22T10:00:00.000Z"),
        zone: ZONE,
        status: "active" as const,
      },
      {
        id: "paused-daily",
        name: "Paused chore",
        cadence: { kind: "daily" as const },
        lastDone: Temporal.Instant.from("2026-09-01T10:00:00.000Z"),
        zone: ZONE,
        status: "paused" as const,
      },
      {
        id: "beyond-horizon",
        name: "Yearly check",
        cadence: { kind: "yearly" as const },
        lastDone: Temporal.Instant.from("2026-09-01T10:00:00.000Z"),
        zone: ZONE,
        status: "active" as const,
      },
    ];

    for (const item of fixtures) {
      await db
        .insert(catalogItems)
        .values(catalogItemToRow(item, { createdAt: CREATED, updatedAt: UPDATED }));
    }

    const result = await loadAndEvaluate(db, {
      clock: fixedClock(NOW),
      horizonDays: 7,
    });

    expect(result.now.equals(NOW)).toBe(true);
    expect(result.horizonDays).toBe(7);
    expect(result.catalog).toHaveLength(5);
    expect(result.evaluated).toHaveLength(5);

    const byId = Object.fromEntries(result.evaluated.map((e) => [e.itemId, e]));

    expect(byId["daily-yday"]!.state).toBe("due");
    expect(byId["daily-yday"]!.nextDue!.equals(TODAY_SOD)).toBe(true);

    expect(byId["daily-new"]!.state).toBe("overdue");
    expect(byId["daily-new"]!.nextDue!.equals(TODAY_SOD)).toBe(true);

    expect(byId["weekly-upcoming"]!.state).toBe("upcoming");
    expect(
      byId["weekly-upcoming"]!.nextDue!.equals(
        Temporal.PlainDate.from("2026-09-29")
          .toZonedDateTime({ timeZone: ZONE, plainTime: "00:00" })
          .toInstant(),
      ),
    ).toBe(true);

    expect(byId["paused-daily"]!.state).toBe("not_applicable");
    expect(byId["paused-daily"]!.nextDue).toBeNull();

    expect(byId["beyond-horizon"]!.state).toBe("not_applicable");

    // due list omits not_applicable
    expect(result.dueList.map((v) => v.id)).toEqual([
      "daily-yday",
      "daily-new",
      "weekly-upcoming",
    ]);
    expect(result.dueList[0]).toMatchObject({
      id: "daily-yday",
      name: "Water plants",
      state: "due",
    });
    expect(result.dueList[0]!.nextDue!.equals(TODAY_SOD)).toBe(true);
  });

  it("omitted horizonDays uses adapter-owned DEFAULT_HORIZON_DAYS", async () => {
    const db = await openTempDb();
    await db.insert(catalogItems).values(
      catalogItemToRow(
        {
          id: "one",
          name: "Solo",
          cadence: { kind: "daily" },
          lastDone: Temporal.Instant.from("2026-09-26T10:00:00.000Z"),
          zone: ZONE,
          status: "active",
        },
        { createdAt: CREATED, updatedAt: UPDATED },
      ),
    );

    const result = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(result.horizonDays).toBe(DEFAULT_HORIZON_DAYS);
    expect(DEFAULT_HORIZON_DAYS).toBe(7);
    expect(result.evaluated[0]!.state).toBe("due");
  });

  it("loadCatalog maps via domain parsers; loadCompletions is empty without rows", async () => {
    const db = await openTempDb();
    await db.insert(catalogItems).values(
      catalogItemToRow(
        {
          id: "c1",
          name: "Chore",
          cadence: { kind: "as_needed" },
          lastDone: null,
          zone: DEFAULT_ZONE,
          status: "active",
        },
        { createdAt: CREATED, updatedAt: UPDATED },
      ),
    );

    const catalog = await loadCatalog(db);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.zone).toBe(DEFAULT_ZONE);
    expect(catalog[0]!.cadence).toEqual({ kind: "as_needed" });

    const comps = await loadCompletions(db);
    expect(comps).toEqual([]);
  });

  it("toDueListViewModels fails loud on length / id mismatch", () => {
    expect(() =>
      toDueListViewModels(
        [
          {
            id: "a",
            name: "A",
            cadence: { kind: "daily" },
            lastDone: null,
            zone: ZONE,
            status: "active",
          },
        ],
        [],
      ),
    ).toThrow(/length mismatch/);

    expect(() =>
      toDueListViewModels(
        [
          {
            id: "a",
            name: "A",
            cadence: { kind: "daily" },
            lastDone: null,
            zone: ZONE,
            status: "active",
          },
        ],
        [{ itemId: "b", state: "due", nextDue: TODAY_SOD }],
      ),
    ).toThrow(/itemId/);
  });

  describe("fail-loud through adapter path (bad persistence rows)", () => {
    const badRowBase = {
      id: "bad-row",
      name: "Bad row",
      cadenceJson: '{"kind":"daily"}',
      lastDoneAt: null as string | null,
      zone: ZONE,
      status: "active" as const,
      createdAt: CREATED_ISO,
      updatedAt: UPDATED_ISO,
    };

    it("loadCatalog / loadAndEvaluate throw on empty zone", async () => {
      const db = await openTempDb();
      await db.insert(catalogItems).values({ ...badRowBase, zone: "" });

      await expect(loadCatalog(db)).rejects.toThrow(/zone is required/);
      await expect(
        loadAndEvaluate(db, { clock: fixedClock(NOW) }),
      ).rejects.toThrow(/zone is required/);
    });

    it("loadCatalog / loadAndEvaluate throw on unknown IANA zone", async () => {
      const db = await openTempDb();
      await db
        .insert(catalogItems)
        .values({ ...badRowBase, zone: "Not/A/RealZone" });

      await expect(loadCatalog(db)).rejects.toThrow(/unknown IANA time zone/);
      await expect(
        loadAndEvaluate(db, { clock: fixedClock(NOW) }),
      ).rejects.toThrow(/unknown IANA time zone/);
    });

    it("loadCatalog / loadAndEvaluate throw on bad last_done_at ISO", async () => {
      const db = await openTempDb();
      await db
        .insert(catalogItems)
        .values({ ...badRowBase, lastDoneAt: "not-an-instant" });

      await expect(loadCatalog(db)).rejects.toThrow();
      await expect(
        loadAndEvaluate(db, { clock: fixedClock(NOW) }),
      ).rejects.toThrow();
    });

    it("loadCatalog / loadAndEvaluate throw on bad cadence JSON", async () => {
      const db = await openTempDb();
      await db
        .insert(catalogItems)
        .values({ ...badRowBase, cadenceJson: '{"kind":"hourly"}' });

      await expect(loadCatalog(db)).rejects.toThrow(InvalidCadenceError);
      await expect(
        loadAndEvaluate(db, { clock: fixedClock(NOW) }),
      ).rejects.toThrow(InvalidCadenceError);
    });

    it("loadCatalog / loadAndEvaluate throw on non-JSON cadence", async () => {
      const db = await openTempDb();
      await db
        .insert(catalogItems)
        .values({ ...badRowBase, cadenceJson: "daily" });

      await expect(loadCatalog(db)).rejects.toThrow(InvalidCadenceError);
      await expect(
        loadAndEvaluate(db, { clock: fixedClock(NOW) }),
      ).rejects.toThrow(InvalidCadenceError);
    });
  });
});
