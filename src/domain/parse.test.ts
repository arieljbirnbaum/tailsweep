/**
 * Focused domain parse failures — invalid everyN, bad ISO, empty zone.
 * Happy-path cadence/catalog round-trips live in src/db/mappers.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  InvalidCadenceError,
  Temporal,
  parseCadence,
  parseCadenceJson,
  parseCatalogItem,
  parseInstantIso,
  parseZone,
} from "./index";

describe("parseCadence / every_n_days", () => {
  it("accepts positive integer days", () => {
    expect(parseCadence({ kind: "every_n_days", days: 1 })).toEqual({
      kind: "every_n_days",
      days: 1,
    });
    expect(parseCadenceJson('{"kind":"every_n_days","days":7}')).toEqual({
      kind: "every_n_days",
      days: 7,
    });
  });

  it.each([
    { name: "zero", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative", raw: { kind: "every_n_days", days: -3 } },
    { name: "float", raw: { kind: "every_n_days", days: 1.5 } },
    { name: "missing days", raw: { kind: "every_n_days" } },
  ])("rejects $name as InvalidCadenceError", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrow(InvalidCadenceError);
  });
});

describe("InvalidCadenceError golden messages", () => {
  const EVERY_N =
    "InvalidCadenceError: every_n_days requires positive integer days and no extra keys";

  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -3 } },
    { name: "float days", raw: { kind: "every_n_days", days: 1.5 } },
    { name: "missing days", raw: { kind: "every_n_days" } },
    { name: "extra key", raw: { kind: "every_n_days", days: 2, x: 1 } },
  ])("parseCadence $name", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrowError(EVERY_N);
  });

  it("unknown kind", () => {
    expect(() => parseCadence({ kind: "hourly" })).toThrowError(
      "InvalidCadenceError: unknown cadence kind: hourly",
    );
  });

  it("named cadence with extra key", () => {
    expect(() => parseCadence({ kind: "daily", days: 1 })).toThrowError(
      "InvalidCadenceError: named cadence daily must have only { kind }",
    );
  });

  it("non-object", () => {
    expect(() => parseCadence("daily")).toThrowError(
      "InvalidCadenceError: cadence must be a JSON object, got string",
    );
  });

  it("missing kind", () => {
    expect(() => parseCadence({})).toThrowError(
      "InvalidCadenceError: cadence.kind must be a string",
    );
  });

  it("parseCadenceJson invalid JSON", () => {
    expect(() => parseCadenceJson("daily")).toThrowError(
      "InvalidCadenceError: cadence_json is not valid JSON: daily",
    );
  });

  it("parseCadenceJson non-object uses cadence_json prefix", () => {
    expect(() => parseCadenceJson("null")).toThrowError(
      "InvalidCadenceError: cadence_json must be a JSON object, got object",
    );
  });

  it("parseCadenceJson zero days keeps hand-rolled every_n message", () => {
    expect(() => parseCadenceJson('{"kind":"every_n_days","days":0}')).toThrowError(
      EVERY_N,
    );
  });
});

describe("parseInstantIso", () => {
  it("constructs Instant from valid ISO", () => {
    const iso = "2026-09-20T10:00:00.000Z";
    expect(parseInstantIso(iso).equals(Temporal.Instant.from(iso))).toBe(true);
  });

  it("rejects bad ISO", () => {
    expect(() => parseInstantIso("not-an-instant")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => parseInstantIso("")).toThrow();
  });
});

describe("parseZone", () => {
  it("accepts IANA id", () => {
    expect(parseZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("rejects empty zone", () => {
    expect(() => parseZone("")).toThrow(/zone is required/);
  });

  it("rejects whitespace-only zone", () => {
    expect(() => parseZone("   ")).toThrow(/zone is required/);
  });
});

describe("parseCatalogItem", () => {
  it("rejects empty zone on assembled item", () => {
    expect(() =>
      parseCatalogItem({
        id: "x",
        name: "x",
        cadence: { kind: "daily" },
        lastDone: null,
        zone: "",
        status: "active",
      }),
    ).toThrow(/zone is required/);
  });

  it("days:0 throws InvalidCadenceError (not raw ZodError)", () => {
    let caught: unknown;
    try {
      parseCatalogItem({
        id: "x",
        name: "x",
        cadence: { kind: "every_n_days", days: 0 },
        lastDone: null,
        zone: "Europe/Berlin",
        status: "active",
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    expect(caught).toMatchObject({
      message:
        "InvalidCadenceError: every_n_days requires positive integer days and no extra keys",
    });
  });
});
