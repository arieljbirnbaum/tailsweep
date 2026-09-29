/**
 * Migrate on a temp SQLite file, insert/select via mappers.
 * Engine purity (no zod / fat @/domain value / drizzle under src/engine) is
 * enforced by ESLint — see eslint.config.mjs `src/engine/**` block.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Temporal } from "@/engine/temporal";

import { createDb } from "./client";
import { catalogItems, completions } from "./schema";
import {
  catalogItemToRow,
  completionToRow,
  rowToCatalogItem,
  rowToCompletion,
} from "./mappers";
import { applyMigrations } from "./migrate";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

const CREATED = Temporal.Instant.from("2026-09-01T08:00:00.000Z");
const UPDATED = Temporal.Instant.from("2026-09-15T12:00:00.000Z");
const LAST_DONE = Temporal.Instant.from("2026-09-20T10:00:00.000Z");
const COMPLETED_AT = Temporal.Instant.from("2026-09-20T10:05:00.000Z");

describe("db migrate + insert/select", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("applies migrations on a clean temp db and round-trips rows", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "duekeep-ail-31-"));
    tempDirs.push(dir);
    const dbPath = path.join(dir, "test.db");
    const db = createDb(`file:${dbPath}`);

    await applyMigrations(db, MIGRATIONS_FOLDER);

    const item = {
      id: "item-1",
      name: "Water plants",
      cadence: { kind: "daily" as const },
      lastDone: LAST_DONE,
      zone: "Europe/Berlin",
      status: "active" as const,
    };
    const itemRow = catalogItemToRow(item, {
      createdAt: CREATED,
      updatedAt: UPDATED,
    });

    await db.insert(catalogItems).values(itemRow);

    const completion = {
      id: "comp-1",
      itemId: "item-1",
      completedAt: COMPLETED_AT,
      note: "morning",
    };
    await db.insert(completions).values(completionToRow(completion));

    const selectedItems = await db.select().from(catalogItems);
    expect(selectedItems).toHaveLength(1);
    const mapped = rowToCatalogItem(selectedItems[0]!);
    expect(mapped.id).toBe(item.id);
    expect(mapped.zone).toBe("Europe/Berlin");
    expect(mapped.lastDone!.equals(LAST_DONE)).toBe(true);
    expect(mapped.cadence).toEqual({ kind: "daily" });

    const selectedCompletions = await db.select().from(completions);
    expect(selectedCompletions).toHaveLength(1);
    const mappedCompletion = rowToCompletion(selectedCompletions[0]!);
    expect(mappedCompletion.itemId).toBe("item-1");
    expect(mappedCompletion.completedAt.equals(COMPLETED_AT)).toBe(true);
    expect(mappedCompletion.note).toBe("morning");
  });

  it("migrations folder exists with SQL", () => {
    const entries = readdirSync(MIGRATIONS_FOLDER);
    const sqlFiles = entries.filter((f) => f.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
    const sql = readFileSync(path.join(MIGRATIONS_FOLDER, sqlFiles[0]!), "utf8");
    expect(sql).toMatch(/catalog_items/);
    expect(sql).toMatch(/completions/);
    // zone must be NOT NULL in the generated migration
    expect(sql).toMatch(/zone.*NOT NULL|\"zone\" text NOT NULL/i);
  });
});
