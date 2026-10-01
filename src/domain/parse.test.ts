/**
 * Focused domain parse failures — invalid everyN, bad ISO, empty/unknown zone.
 * Happy-path cadence/catalog round-trips live in src/db/mappers.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  InvalidCadenceError,
  Temporal,
  createCadence,
  createEvaluateOptions,
  parseCadence,
  parseCadenceJson,
  parseCatalogItem,
  parseEvaluateOptions,
  parseInstantIso,
  parseZone,
} from "./index";

describe("createCadence / parseCadence / every_n_days", () => {
  it("createCadence accepts positive integer days", () => {
    expect(createCadence({ kind: "every_n_days", days: 1 })).toEqual({
      kind: "every_n_days",
      days: 1,
    });
  });

  it("parseCadence / parseCadenceJson accept positive integer days", () => {
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

  it("createCadence rejects non-positive days", () => {
    expect(() => createCadence({ kind: "every_n_days", days: 0 })).toThrow(
      InvalidCadenceError,
    );
  });
});

describe("InvalidCadenceError — Zod-sourced messages", () => {
  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -3 } },
  ])("parseCadence $name includes Zod too_small at days", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrowError(/Too small: expected number to be >0/);
    expect(() => parseCadence(raw)).toThrowError(/at days/);
    try {
      parseCadence(raw);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidCadenceError);
    }
  });

  it.each([
    { name: "float days", raw: { kind: "every_n_days", days: 1.5 } },
    { name: "NaN days", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "missing days", raw: { kind: "every_n_days" } },
    { name: "extra key", raw: { kind: "every_n_days", days: 2, x: 1 } },
  ])("parseCadence $name throws InvalidCadenceError with Zod copy", ({ raw }) => {
    expect(() => parseCadence(raw)).toThrow(InvalidCadenceError);
    try {
      parseCadence(raw);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidCadenceError);
      if (!(err instanceof InvalidCadenceError)) throw err;
      // Zod prettify: ✖ … lines — not hand-rolled kind-branch copy.
      expect(err.message).toMatch(/✖/);
    }
  });

  it("unknown kind uses Zod invalid_union / invalid option copy", () => {
    expect(() => parseCadence({ kind: "hourly" })).toThrow(InvalidCadenceError);
    expect(() => parseCadence({ kind: "hourly" })).toThrowError(/Invalid/);
  });

  it("named cadence with extra key uses Zod unrecognized_keys", () => {
    expect(() => parseCadence({ kind: "daily", days: 1 })).toThrowError(
      /Unrecognized key: "days"/,
    );
  });

  it("non-object uses Zod type error", () => {
    // Union prettify collapses to "Invalid input" (issues still have type detail).
    expect(() => parseCadence("daily")).toThrow(InvalidCadenceError);
    expect(() => parseCadence("daily")).toThrowError(/Invalid input/);
  });

  it("missing kind uses Zod copy", () => {
    expect(() => parseCadence({})).toThrow(InvalidCadenceError);
    expect(() => parseCadence({})).toThrowError(/Invalid/);
  });

  it("parseCadenceJson invalid JSON wraps SyntaxError message", () => {
    expect(() => parseCadenceJson("daily")).toThrowError(
      /cadence_json is not valid JSON: Unexpected token/,
    );
  });

  it("parseCadenceJson non-object uses Zod formatting (via parseCadence)", () => {
    expect(() => parseCadenceJson("null")).toThrow(InvalidCadenceError);
    expect(() => parseCadenceJson("null")).toThrowError(/Invalid input/);
  });

  it("parseCadenceJson zero days uses Zod too_small", () => {
    expect(() =>
      parseCadenceJson('{"kind":"every_n_days","days":0}'),
    ).toThrowError(/Too small: expected number to be >0/);
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

  it("days:0 throws InvalidCadenceError wrapping Zod message", () => {
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
    expect(caught.message).toMatch(/Too small: expected number to be >0/);
    expect(caught.message).toMatch(/at days/);
  });
});

describe("branded Cadence — invalid cannot be built via public API", () => {
  it("createCadence / parseCadence return Cadence (happy path)", () => {
    expect(createCadence({ kind: "daily" }).kind).toBe("daily");
    expect(parseCadence({ kind: "daily" }).kind).toBe("daily");
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

describe("createEvaluateOptions / parseEvaluateOptions — branded", () => {
  it("createEvaluateOptions accepts positive integer horizonDays", () => {
    expect(createEvaluateOptions({ horizonDays: 1 }).horizonDays).toBe(1);
    expect(createEvaluateOptions({ horizonDays: 14 }).horizonDays).toBe(14);
  });

  it("parseEvaluateOptions accepts positive integer horizonDays", () => {
    expect(parseEvaluateOptions({ horizonDays: 1 }).horizonDays).toBe(1);
    expect(parseEvaluateOptions({ horizonDays: 14 }).horizonDays).toBe(14);
  });

  it.each([
    { name: "zero", raw: { horizonDays: 0 }, re: /Too small: expected number to be >0/ },
    { name: "negative", raw: { horizonDays: -3 }, re: /Too small: expected number to be >0/ },
    { name: "float", raw: { horizonDays: 1.5 }, re: /expected int/ },
    { name: "NaN", raw: { horizonDays: Number.NaN }, re: /NaN|number/ },
    { name: "missing", raw: {}, re: /horizonDays|undefined/ },
    { name: "extra key", raw: { horizonDays: 7, x: 1 }, re: /Unrecognized key/ },
  ])("rejects $name as RangeError with Zod message", ({ raw, re }) => {
    expect(() => parseEvaluateOptions(raw)).toThrow(RangeError);
    expect(() => parseEvaluateOptions(raw)).toThrow(re);
  });

  it("createEvaluateOptions rejects zero with Zod-sourced RangeError", () => {
    expect(() => createEvaluateOptions({ horizonDays: 0 })).toThrow(RangeError);
    expect(() => createEvaluateOptions({ horizonDays: 0 })).toThrow(
      /Too small: expected number to be >0/,
    );
  });
});
