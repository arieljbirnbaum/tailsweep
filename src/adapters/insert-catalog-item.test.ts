/**
 * insertCatalogItem against temp SQLite, then the same mark-done shape:
 * a daily never-done item is overdue, and markDone moves it off overdue.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyMigrations, catalogItems, createDb, type Db } from "@/db";
import { closeClients, removeTempDirs } from "@/db/test-temp-db";
import { cadence } from "@/domain";
import { fixedClock, Temporal } from "@/engine";

import { insertCatalogItem } from "./insert-catalog-item";
import { loadAndEvaluate } from "./load-and-evaluate";
import { loadCatalog } from "./load-catalog";
import { markDone } from "./mark-done";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const ZONE = "Europe/Berlin";
/** Sun afternoon UTC ≈ Berlin CEST (local calendar date 2026-09-27). */
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z");
const CREATED = Temporal.Instant.from("2026-09-01T08:00:00.000Z");

function startOfLocalDay(
  instant: Temporal.Instant,
  zone: string = ZONE,
): Temporal.Instant {
  return instant.toZonedDateTimeISO(zone).startOfDay().toInstant();
}

const TODAY_SOD = startOfLocalDay(NOW);
const NEXT_LOCAL_DAY_SOD = NOW.toZonedDateTimeISO(ZONE)
  .startOfDay()
  .add({ days: 1 })
  .toInstant();

describe("insertCatalogItem", () => {
  const tempDirs: string[] = [];
  const openDbs: Db[] = [];

  afterEach(async () => {
    await closeClients(openDbs);
    await removeTempDirs(tempDirs, "insert-catalog-item.test");
  });

  async function openTempDb(): Promise<Db> {
    const dir = mkdtempSync(path.join(tmpdir(), "tailsweep-ail-33-"));
    tempDirs.push(dir);
    const db = createDb(`file:${path.join(dir, "test.db")}`);
    openDbs.push(db);
    await applyMigrations(db, MIGRATIONS_FOLDER);
    return db;
  }

  it("inserts an active never-done item that loadAndEvaluate sees, then markDone moves daily off overdue", async () => {
    const db = await openTempDb();

    await insertCatalogItem(db, {
      id: "plants",
      name: "Water plants",
      cadence: cadence({ kind: "daily" }),
      zone: ZONE,
      at: CREATED,
    });

    const catalog = await loadCatalog(db);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: "plants",
      name: "Water plants",
      status: "active",
      zone: ZONE,
      lastDone: null,
    });
    expect(catalog[0]!.cadence).toMatchObject({ kind: "daily" });

    const rows = await db.select().from(catalogItems);
    expect(rows[0]!.createdAt).toBe(CREATED.toString());
    expect(rows[0]!.updatedAt).toBe(CREATED.toString());
    expect(rows[0]!.lastDoneAt).toBeNull();

    const before = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(before.dueList.map((view) => view.id)).toEqual(["plants"]);
    expect(before.evaluated[0]!.state).toBe("overdue");
    expect(before.evaluated[0]!.nextDue!.equals(TODAY_SOD)).toBe(true);
    expect(before.dueList[0]!.state).toBe("overdue");

    await markDone(db, {
      itemId: "plants",
      completedAt: NOW,
      completionId: "comp-plants-1",
    });

    const after = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(after.evaluated[0]!.state).toBe("upcoming");
    expect(after.evaluated[0]!.nextDue!.equals(NEXT_LOCAL_DAY_SOD)).toBe(true);
    expect(after.dueList[0]!.state).toBe("upcoming");
    expect(after.dueList[0]!.state).not.toBe("overdue");
  });

  it("inserts every_n_days with a positive day count (e.g. every two weeks)", async () => {
    const db = await openTempDb();

    await insertCatalogItem(db, {
      id: "trash",
      name: "Take out trash",
      cadence: cadence({ kind: "every_n_days", days: 14 }),
      zone: ZONE,
      at: CREATED,
    });

    const catalog = await loadCatalog(db);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.cadence).toMatchObject({ kind: "every_n_days", days: 14 });
  });

  it("fails loud on bad zone and does not insert", async () => {
    const db = await openTempDb();

    await expect(
      insertCatalogItem(db, {
        id: "bad-zone",
        name: "Nope",
        cadence: cadence({ kind: "weekly" }),
        zone: "Not/AZone",
        at: CREATED,
      }),
    ).rejects.toBeInstanceOf(TypeError);

    expect(await loadCatalog(db)).toEqual([]);
  });
});
