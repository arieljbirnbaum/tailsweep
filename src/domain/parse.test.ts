/**
 * Focused domain parse failures — invalid everyN, bad ISO, empty/unknown zone.
 * Happy-path cadence/catalog round-trips live in src/db/mappers.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  InvalidCadenceError,
  Temporal,
  parseCadence,
  parseCadenceJson,
  parseCatalogItem,
  parseEvaluateOptions,
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
    { name: "NaN", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "missing days", raw: { kind: "every_n_days" } },
  ])("rejects $name as InvalidCadenceError", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrow(InvalidCadenceError);
  });
});

describe("InvalidCadenceError golden messages", () => {
  const EVERY_N = /every_n_days requires positive integer days and no extra keys/;

  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -3 } },
    { name: "float days", raw: { kind: "every_n_days", days: 1.5 } },
    { name: "NaN days", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "missing days", raw: { kind: "every_n_days" } },
    { name: "extra key", raw: { kind: "every_n_days", days: 2, x: 1 } },
  ])("parseCadence $name", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrowError(EVERY_N);
    try {
      parseCadence(raw);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidCadenceError);
      if (!(err instanceof InvalidCadenceError)) throw err;
      expect(err.message).toMatch(/\([^)]+:/);
    }
  });

  it("unknown kind", () => {
    expect(() => parseCadence({ kind: "hourly" })).toThrowError(
      /unknown cadence kind: hourly/,
    );
  });

  it("named cadence with extra key", () => {
    expect(() => parseCadence({ kind: "daily", days: 1 })).toThrowError(
      /named cadence daily must have only \{ kind \}/,
    );
  });

  it("non-object", () => {
    expect(() => parseCadence("daily")).toThrowError(
      /cadence must be a JSON object, got string/,
    );
  });

  it("missing kind", () => {
    expect(() => parseCadence({})).toThrowError(/cadence\.kind must be a string/);
  });

  it("parseCadenceJson invalid JSON includes SyntaxError message", () => {
    expect(() => parseCadenceJson("daily")).toThrowError(
      /cadence_json is not valid JSON: Unexpected token/,
    );
    expect(() => parseCadenceJson("daily")).not.toThrowError(/: daily$/);
  });

  it("parseCadenceJson non-object uses cadence_json prefix", () => {
    expect(() => parseCadenceJson("null")).toThrowError(
      /cadence_json must be a JSON object, got object/,
    );
  });

  it("parseCadenceJson zero days keeps hand-rolled every_n message plus Zod detail", () => {
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
  it("accepts IANA id Europe/Berlin", () => {
    expect(parseZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("accepts UTC (Temporal-valid even when Intl omits it)", () => {
    expect(parseZone("UTC")).toBe("UTC");
  });

  it("rejects empty zone", () => {
    expect(() => parseZone("")).toThrow(/zone is required/);
  });

  it("rejects whitespace-only zone", () => {
    expect(() => parseZone("   ")).toThrow(/zone is required/);
  });

  it("rejects padded zone (no trim coercion)", () => {
    expect(() => parseZone(" Europe/Berlin ")).toThrow(/whitespace/);
  });

  it("rejects unknown IANA id at parseZone (not only evaluate)", () => {
    expect(() => parseZone("Not/ARealZone")).toThrow(/unknown IANA time zone/);
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

  it("rejects nonsense zone at parse (not deferred to evaluate)", () => {
    expect(() =>
      parseCatalogItem({
        id: "x",
        name: "x",
        cadence: { kind: "daily" },
        lastDone: null,
        zone: "Fake/Zone",
        status: "active",
      }),
    ).toThrow(/unknown IANA time zone/);
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
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(
      /every_n_days requires positive integer days and no extra keys/,
    );
    expect(caught.message).toMatch(/days:/);
  });
});

describe("branded Cadence — invalid cannot be built via public API", () => {
  it("parseCadence returns a value usable as Cadence (happy path)", () => {
    const c = parseCadence({ kind: "daily" });
    expect(c.kind).toBe("daily");
  });

  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -1 } },
    { name: "float days", raw: { kind: "every_n_days", days: 2.5 } },
    { name: "NaN days", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "unknown kind", raw: { kind: "hourly" } },
  ])("rejects $name — no Cadence value escapes", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrow(InvalidCadenceError);
  });
});

describe("parseEvaluateOptions — branded valid-by-construction", () => {
  it("accepts positive integer horizonDays", () => {
    expect(parseEvaluateOptions({ horizonDays: 1 }).horizonDays).toBe(1);
    expect(parseEvaluateOptions({ horizonDays: 14 }).horizonDays).toBe(14);
  });

  it.each([
    { name: "zero", raw: { horizonDays: 0 } },
    { name: "negative", raw: { horizonDays: -3 } },
    { name: "float", raw: { horizonDays: 1.5 } },
    { name: "NaN", raw: { horizonDays: Number.NaN } },
    { name: "missing", raw: {} },
    { name: "extra key", raw: { horizonDays: 7, x: 1 } },
  ])("rejects $name as RangeError", ({ raw }) => {
    expect(() => parseEvaluateOptions(raw)).toThrow(RangeError);
    expect(() => parseEvaluateOptions(raw)).toThrow(/horizonDays must be a positive integer/);
  });
});
