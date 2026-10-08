/**
 * markDone against temp SQLite: completion row + lastDone, then evaluate.
 * Shared cleanup: @/db/test-temp-db.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigrations,
  catalogItemToRow,
  catalogItems,
  completionToRow,
  completions,
  createDb,
  type CatalogItemRow,
  type CompletionRow,
  type Db,
} from "@/db";
import { closeClients, removeTempDirs } from "@/db/test-temp-db";
import { cadence, type CatalogItem } from "@/domain";
import { fixedClock, Temporal } from "@/engine";

import { CatalogItemNotFoundError } from "./errors";
import { loadAndEvaluate } from "./load-and-evaluate";
import { loadCatalog, loadCompletions } from "./load-catalog";
import { markDone } from "./mark-done";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const ZONE = "Europe/Berlin";
/** Sun afternoon UTC ≈ Berlin CEST (local calendar date 2026-09-27). */
const NOW = Temporal.Instant.from("2026-09-27T12:00:00.000Z");
const CREATED = Temporal.Instant.from("2026-09-01T08:00:00.000Z");
const UPDATED = Temporal.Instant.from("2026-09-15T12:00:00.000Z");

function startOfLocalDay(
  instant: Temporal.Instant,
  zone: string = ZONE,
): Temporal.Instant {
  return instant.toZonedDateTimeISO(zone).startOfDay().toInstant();
}

const TODAY_SOD = startOfLocalDay(NOW);
/** SOD of the next civil day after `NOW` in Europe/Berlin. */
const NEXT_LOCAL_DAY_SOD = NOW.toZonedDateTimeISO(ZONE)
  .startOfDay()
  .add({ days: 1 })
  .toInstant();

function item(
  partial: Pick<CatalogItem, "id" | "name" | "lastDone" | "status"> &
    Partial<Pick<CatalogItem, "cadence">>,
): CatalogItem {
  return {
    cadence: partial.cadence ?? cadence({ kind: "daily" }),
    zone: ZONE,
    ...partial,
  };
}

describe("markDone", () => {
  const tempDirs: string[] = [];
  const openDbs: Db[] = [];

  afterEach(async () => {
    await closeClients(openDbs);
    await removeTempDirs(tempDirs, "mark-done.test");
  });

  async function openTempDb(): Promise<Db> {
    const dir = mkdtempSync(path.join(tmpdir(), "tailsweep-ail-32-"));
    tempDirs.push(dir);
    const db = createDb(`file:${path.join(dir, "test.db")}`);
    openDbs.push(db);
    await applyMigrations(db, MIGRATIONS_FOLDER);
    return db;
  }

  async function insertItem(db: Db, catalogItem: CatalogItem): Promise<void> {
    await db
      .insert(catalogItems)
      .values(catalogItemToRow(catalogItem, { createdAt: CREATED, updatedAt: UPDATED }));
  }

  async function snapshot(db: Db): Promise<{
    catalog: CatalogItemRow[];
    completions: CompletionRow[];
  }> {
    return {
      catalog: await db.select().from(catalogItems),
      completions: await db.select().from(completions),
    };
  }

  it("writes completion + lastDone and the next evaluate uses that anchor", async () => {
    const db = await openTempDb();
    // Scheduled + never done is overdue with nextDue = today SOD (engine rule).
    // A past lastDone is also overdue, but nextDue stays the cadence day — not this case.
    await insertItem(
      db,
      item({
        id: "plants",
        name: "Water plants",
        lastDone: null,
        status: "active",
      }),
    );

    const before = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(before.evaluated).toHaveLength(1);
    expect(before.evaluated[0]!.state).toBe("overdue");
    expect(before.evaluated[0]!.nextDue!.equals(TODAY_SOD)).toBe(true);

    await markDone(db, {
      itemId: "plants",
      completedAt: NOW,
      completionId: "comp-plants-1",
      note: "watered",
    });

    const catalog = await loadCatalog(db);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.lastDone).not.toBeNull();
    expect(catalog[0]!.lastDone!.equals(NOW)).toBe(true);

    const comps = await loadCompletions(db);
    expect(comps).toHaveLength(1);
    expect(comps[0]).toMatchObject({
      id: "comp-plants-1",
      itemId: "plants",
      note: "watered",
    });
    expect(comps[0]!.completedAt.equals(NOW)).toBe(true);

    const rows = await snapshot(db);
    expect(rows.catalog[0]!.updatedAt).toBe(UPDATED.toString());
    expect(rows.catalog[0]!.createdAt).toBe(CREATED.toString());

    const after = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(after.horizonDays).toBe(7);
    expect(after.evaluated[0]!.state).toBe("upcoming");
    expect(after.evaluated[0]!.nextDue!.equals(NEXT_LOCAL_DAY_SOD)).toBe(true);
    expect(after.dueList.map((view) => view.id)).toEqual(["plants"]);
    expect(after.dueList[0]!.state).toBe("upcoming");
  });

  it("stores omitted or null note as SQL null", async () => {
    const db = await openTempDb();
    await insertItem(db, item({ id: "a", name: "A", lastDone: null, status: "active" }));
    await insertItem(db, item({ id: "b", name: "B", lastDone: null, status: "active" }));

    await markDone(db, {
      itemId: "a",
      completedAt: NOW,
      completionId: "comp-a",
    });
    await markDone(db, {
      itemId: "b",
      completedAt: NOW,
      completionId: "comp-b",
      note: null,
    });

    const comps = await loadCompletions(db);
    const byId = Object.fromEntries(comps.map((row) => [row.id, row]));
    expect(byId["comp-a"]!.note).toBeNull();
    expect(byId["comp-b"]!.note).toBeNull();
  });

  it("records completedAt before the previous lastDone as given", async () => {
    const earlier = Temporal.Instant.from("2026-09-01T10:00:00.000Z");
    const db = await openTempDb();
    await insertItem(
      db,
      item({
        id: "plants",
        name: "Water plants",
        lastDone: NOW,
        status: "active",
      }),
    );

    await markDone(db, {
      itemId: "plants",
      completedAt: earlier,
      completionId: "comp-earlier",
    });

    const catalog = await loadCatalog(db);
    expect(catalog[0]!.lastDone!.equals(earlier)).toBe(true);
    const comps = await loadCompletions(db);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.id).toBe("comp-earlier");
    expect(comps[0]!.completedAt.equals(earlier)).toBe(true);
  });

  it("does not special-case paused: completion + lastDone, evaluate stays not_applicable", async () => {
    const db = await openTempDb();
    await insertItem(
      db,
      item({
        id: "paused-plants",
        name: "Paused plants",
        lastDone: null,
        status: "paused",
      }),
    );

    const before = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(before.evaluated[0]!.state).toBe("not_applicable");
    expect(before.evaluated[0]!.nextDue).toBeNull();

    await markDone(db, {
      itemId: "paused-plants",
      completedAt: NOW,
      completionId: "comp-paused",
    });

    const catalog = await loadCatalog(db);
    expect(catalog[0]!.status).toBe("paused");
    expect(catalog[0]!.lastDone!.equals(NOW)).toBe(true);

    const after = await loadAndEvaluate(db, { clock: fixedClock(NOW) });
    expect(after.evaluated[0]!.state).toBe("not_applicable");
    expect(after.evaluated[0]!.nextDue).toBeNull();
    expect(after.dueList).toEqual([]);

    const comps = await loadCompletions(db);
    expect(comps).toHaveLength(1);
    expect(comps[0]!.completedAt.equals(NOW)).toBe(true);
  });

  it("missing item throws CatalogItemNotFoundError and leaves the DB unchanged", async () => {
    const db = await openTempDb();
    const existing = item({
      id: "plants",
      name: "Water plants",
      lastDone: Temporal.Instant.from("2026-09-20T10:00:00.000Z"),
      status: "active",
    });
    await insertItem(db, existing);
    await db.insert(completions).values(
      completionToRow({
        id: "comp-existing",
        itemId: "plants",
        completedAt: existing.lastDone!,
        note: "kept",
      }),
    );

    const before = await snapshot(db);

    let thrown: unknown;
    try {
      await markDone(db, {
        itemId: "missing-item",
        completedAt: NOW,
        completionId: "comp-should-not-exist",
        note: "nope",
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(CatalogItemNotFoundError);
    if (!(thrown instanceof CatalogItemNotFoundError)) {
      throw new Error("expected CatalogItemNotFoundError");
    }
    expect(thrown.name).toBe("CatalogItemNotFoundError");
    expect(thrown.code).toBe("CATALOG_ITEM_NOT_FOUND");
    expect(thrown.itemId).toBe("missing-item");

    const after = await snapshot(db);
    expect(after).toEqual(before);
    expect(after.completions.map((row) => row.id)).toEqual(["comp-existing"]);
    expect(after.catalog[0]!.lastDoneAt).toBe(existing.lastDone!.toString());
  });
});
