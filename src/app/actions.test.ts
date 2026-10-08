/**
 * createCatalogItemAction at the action boundary: FormData in, Conform
 * submission result out, row written (or not) in a temp SQLite DB.
 * Rejections must leave the catalog untouched.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyMigrations, catalogItems, createDb, type Db } from "@/db";
import { closeClients, removeTempDirs } from "@/db/test-temp-db";

const appDb = vi.hoisted(() => {
  const state: { current: unknown; fail: Error | undefined } = {
    current: undefined,
    fail: undefined,
  };
  return state;
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./db", () => ({
  getAppDb: async () => {
    if (appDb.fail) throw appDb.fail;
    return appDb.current;
  },
}));

const { createCatalogItemAction } = await import("./actions");

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = { name: "Water plants", zone: "Europe/Berlin" } as const;

describe("createCatalogItemAction", () => {
  const tempDirs: string[] = [];
  const openDbs: Db[] = [];
  let db: Db;

  beforeEach(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tailsweep-ail-43-"));
    tempDirs.push(dir);
    db = createDb(`file:${path.join(dir, "test.db")}`);
    openDbs.push(db);
    await applyMigrations(db, MIGRATIONS_FOLDER);
    appDb.current = db;
    appDb.fail = undefined;
  });

  afterEach(async () => {
    await closeClients(openDbs);
    await removeTempDirs(tempDirs, "actions.test");
  });

  async function rows() {
    return db.select().from(catalogItems);
  }

  it("inserts a no-argument cadence", async () => {
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "daily" }),
    );
    expect(result.error).toBeUndefined();
    const inserted = await rows();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.name).toBe("Water plants");
    expect(inserted[0]?.zone).toBe("Europe/Berlin");
    expect(JSON.parse(inserted[0]?.cadenceJson ?? "null")).toEqual({ kind: "daily" });
  });

  it("inserts every_n_days with strict decimal days", async () => {
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "every_n_days", "cadence.days": "14" }),
    );
    expect(result.error).toBeUndefined();
    const inserted = await rows();
    expect(inserted[0]?.zone).toBe("Europe/Berlin");
    expect(JSON.parse(inserted[0]?.cadenceJson ?? "null")).toEqual({
      kind: "every_n_days",
      days: 14,
    });
  });

  it("ignores React $ACTION_* plumbing fields only", async () => {
    const result = await createCatalogItemAction(
      null,
      form({
        ...VALID,
        "cadence.kind": "daily",
        $ACTION_REF_1: "",
        "$ACTION_1:0": "{}",
        "$ACTION_1:1": "[]",
        $ACTION_KEY: "k",
      }),
    );
    expect(result.error).toBeUndefined();
  });

  it.each(["", "0", "-1", "1.5", " 14 ", "14 ", " 14", "1e1", "0x0e", "014", "+14", "14\n", "99999999999999999999"])(
    "rejects every_n_days days %j on cadence.days, no insert",
    async (days) => {
      const result = await createCatalogItemAction(
        null,
        form({ ...VALID, "cadence.kind": "every_n_days", "cadence.days": days }),
      );
      expect(result.status).toBe("error");
      expect(result.error?.["cadence.days"]?.length).toBeGreaterThan(0);
      expect(await rows()).toHaveLength(0);
    },
  );

  it("rejects every_n_days without days on cadence.days", async () => {
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "every_n_days" }),
    );
    expect(result.status).toBe("error");
    expect(result.error?.["cadence.days"]?.length).toBeGreaterThan(0);
    expect(await rows()).toHaveLength(0);
  });

  it("rejects a no-argument kind sent with days (not dropped), no insert", async () => {
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "daily", "cadence.days": "3" }),
    );
    expect(result.status).toBe("error");
    expect(result.error?.["cadence"]?.join(" ")).toMatch(/days/);
    expect(await rows()).toHaveLength(0);
  });

  it("rejects an unknown kind on cadence.kind", async () => {
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "fortnightly" }),
    );
    expect(result.status).toBe("error");
    expect(result.error?.["cadence.kind"]?.length).toBeGreaterThan(0);
    expect(await rows()).toHaveLength(0);
  });

  it.each([
    ["missing name", { zone: VALID.zone, "cadence.kind": "daily" }, "name"],
    ["empty name", { name: "", zone: VALID.zone, "cadence.kind": "daily" }, "name"],
    ["unknown zone", { name: VALID.name, zone: "Mars/Olympus", "cadence.kind": "daily" }, "zone"],
    ["padded zone", { name: VALID.name, zone: " Europe/Berlin", "cadence.kind": "daily" }, "zone"],
    ["missing cadence", { ...VALID }, "cadence"],
  ] as const)("rejects %s on its field", async (_label, fields, key) => {
    const result = await createCatalogItemAction(null, form(fields));
    expect(result.status).toBe("error");
    expect(result.error?.[key]?.length).toBeGreaterThan(0);
    expect(await rows()).toHaveLength(0);
  });

  it.each([
    ["top-level", { ...VALID, "cadence.kind": "daily", extra: "x" }],
    ["inside cadence", { ...VALID, "cadence.kind": "daily", "cadence.hours": "3" }],
  ] as const)("rejects an unknown %s field instead of dropping it", async (_label, fields) => {
    const result = await createCatalogItemAction(null, form(fields));
    expect(result.status).toBe("error");
    expect(await rows()).toHaveLength(0);
  });

  it("rejects a duplicated field instead of picking one", async () => {
    const data = form({ ...VALID, "cadence.kind": "daily" });
    data.append("name", "Second name");
    const result = await createCatalogItemAction(null, data);
    expect(result.status).toBe("error");
    expect(result.error?.["name"]?.length).toBeGreaterThan(0);
    expect(await rows()).toHaveLength(0);
  });

  it("reports adapter / DB failures as form-level errors", async () => {
    appDb.fail = new Error("db offline");
    const result = await createCatalogItemAction(
      null,
      form({ ...VALID, "cadence.kind": "daily" }),
    );
    expect(result.status).toBe("error");
    expect(result.error?.[""]).toEqual(["db offline"]);
  });
});
