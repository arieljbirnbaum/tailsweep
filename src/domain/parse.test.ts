/**
 * Focused domain parse failures — invalid everyN, bad ISO, empty/unknown zone.
 * Happy-path cadence/catalog round-trips live in src/db/mappers.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  InvalidCadenceError,
  Temporal,
  cadence,
  evaluateOptions,
  parseCadence,
  parseCadenceJson,
  parseCatalogItem,
  parseEvaluateOptions,
  parseInstantIso,
  parseZone,
} from "./index";

describe("cadence / parseCadence / every_n_days", () => {
  it("cadence accepts positive integer days", () => {
    expect(cadence({ kind: "every_n_days", days: 1 })).toEqual({
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
    let caught: unknown;
    try {
      parseCadence(raw);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
  });

  it("cadence rejects non-positive days", () => {
    let caught: unknown;
    try {
      cadence({ kind: "every_n_days", days: 0 });
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

describe("InvalidCadenceError — Zod-sourced messages", () => {
  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -3 } },
  ])("parseCadence $name includes Zod too_small at days", ({ raw }) => {
    let caught: unknown;
    try {
      parseCadence(raw);
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

  it.each([
    { name: "float days", raw: { kind: "every_n_days", days: 1.5 } },
    { name: "NaN days", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "missing days", raw: { kind: "every_n_days" } },
    { name: "extra key", raw: { kind: "every_n_days", days: 2, x: 1 } },
  ])("parseCadence $name throws InvalidCadenceError with Zod copy", ({ raw }) => {
    let caught: unknown;
    try {
      parseCadence(raw);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    // Zod prettify: ✖ … lines — not hand-rolled kind-branch copy.
    expect(caught.message).toMatch(/✖/);
  });

  it("unknown kind uses Zod invalid_union / invalid option copy", () => {
    let caught: unknown;
    try {
      parseCadence({ kind: "hourly" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Invalid/);
  });

  it("named cadence with extra key uses Zod unrecognized_keys", () => {
    let caught: unknown;
    try {
      parseCadence({ kind: "daily", days: 1 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Unrecognized key: "days"/);
  });

  it("non-object uses Zod type error", () => {
    // Union prettify collapses to "Invalid input" (issues still have type detail).
    let caught: unknown;
    try {
      parseCadence("daily");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Invalid input/);
  });

  it("missing kind uses Zod copy", () => {
    let caught: unknown;
    try {
      parseCadence({});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Invalid/);
  });

  it("parseCadenceJson invalid JSON wraps SyntaxError message", () => {
    let caught: unknown;
    try {
      parseCadenceJson("daily");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(
      /cadence_json is not valid JSON: Unexpected token/,
    );
  });

  it("parseCadenceJson non-object uses Zod formatting (via parseCadence)", () => {
    let caught: unknown;
    try {
      parseCadenceJson("null");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
    if (!(caught instanceof InvalidCadenceError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Invalid input/);
  });

  it("parseCadenceJson zero days uses Zod too_small", () => {
    let caught: unknown;
    try {
      parseCadenceJson('{"kind":"every_n_days","days":0}');
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
  it("cadence / parseCadence return Cadence (happy path)", () => {
    expect(cadence({ kind: "daily" }).kind).toBe("daily");
    expect(parseCadence({ kind: "daily" }).kind).toBe("daily");
  });

  it.each([
    { name: "zero days", raw: { kind: "every_n_days", days: 0 } },
    { name: "negative days", raw: { kind: "every_n_days", days: -1 } },
    { name: "float days", raw: { kind: "every_n_days", days: 2.5 } },
    { name: "NaN days", raw: { kind: "every_n_days", days: Number.NaN } },
    { name: "unknown kind", raw: { kind: "hourly" } },
  ])("rejects $name — no Cadence value escapes", ({ raw }) => {
    let caught: unknown;
    try {
      parseCadence(raw);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidCadenceError);
  });
});

describe("evaluateOptions / parseEvaluateOptions — branded", () => {
  it("evaluateOptions accepts positive integer horizonDays", () => {
    expect(evaluateOptions({ horizonDays: 1 }).horizonDays).toBe(1);
    expect(evaluateOptions({ horizonDays: 14 }).horizonDays).toBe(14);
  });

  it("parseEvaluateOptions accepts positive integer horizonDays", () => {
    expect(parseEvaluateOptions({ horizonDays: 1 }).horizonDays).toBe(1);
    expect(parseEvaluateOptions({ horizonDays: 14 }).horizonDays).toBe(14);
  });

  it.each([
    {
      name: "zero",
      raw: { horizonDays: 0 },
      message: /Too small: expected number to be >0/,
      path: /at horizonDays/,
    },
    {
      name: "negative",
      raw: { horizonDays: -3 },
      message: /Too small: expected number to be >0/,
      path: /at horizonDays/,
    },
    {
      name: "float",
      raw: { horizonDays: 1.5 },
      message: /expected int/,
      path: /at horizonDays/,
    },
    {
      name: "NaN",
      raw: { horizonDays: Number.NaN },
      message: /NaN|number/,
      path: /at horizonDays/,
    },
    {
      name: "missing",
      raw: {},
      message: /horizonDays|undefined/,
      path: /at horizonDays/,
    },
    {
      name: "extra key",
      raw: { horizonDays: 7, x: 1 },
      message: /Unrecognized key/,
      path: undefined,
    },
  ])("rejects $name as RangeError with Zod message", ({ raw, message, path }) => {
    let caught: unknown;
    try {
      parseEvaluateOptions(raw);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RangeError);
    if (!(caught instanceof RangeError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(message);
    if (path !== undefined) {
      expect(caught.message).toMatch(path);
    }
  });

  it("evaluateOptions rejects zero with Zod-sourced RangeError", () => {
    let caught: unknown;
    try {
      evaluateOptions({ horizonDays: 0 });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RangeError);
    if (!(caught instanceof RangeError)) {
      throw caught instanceof Error ? caught : new Error(String(caught));
    }
    expect(caught.message).toMatch(/Too small: expected number to be >0/);
    expect(caught.message).toMatch(/at horizonDays/);
  });
});
