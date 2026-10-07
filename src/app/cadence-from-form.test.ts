import { describe, expect, it } from "vitest";

import { InvalidCadenceError } from "@/domain";

import {
  cadenceFromForm,
  parseStrictPositiveIntDecimal,
} from "./cadence-from-form";

describe("parseStrictPositiveIntDecimal", () => {
  it("accepts plain positive decimal integers", () => {
    expect(parseStrictPositiveIntDecimal("1")).toBe(1);
    expect(parseStrictPositiveIntDecimal("14")).toBe(14);
  });

  it.each([
    "",
    "0",
    "-1",
    "1.5",
    " 14 ",
    "14 ",
    " 14",
    "1e1",
    "0x0e",
    "014",
    "+14",
    "14\n",
  ])("rejects %j", (raw) => {
    expect(parseStrictPositiveIntDecimal(raw)).toBeNull();
  });
});

describe("cadenceFromForm", () => {
  it("builds no-argument and every_n_days cadences", () => {
    expect(cadenceFromForm("weekly", null)).toMatchObject({ kind: "weekly" });
    expect(cadenceFromForm("every_n_days", "14")).toMatchObject({
      kind: "every_n_days",
      days: 14,
    });
  });

  it("fails loud on missing or lax days for every_n_days", () => {
    expect(() => cadenceFromForm("every_n_days", null)).toThrow(
      InvalidCadenceError,
    );
    expect(() => cadenceFromForm("every_n_days", "")).toThrow(
      InvalidCadenceError,
    );
    expect(() => cadenceFromForm("every_n_days", "0")).toThrow(
      InvalidCadenceError,
    );
    expect(() => cadenceFromForm("every_n_days", "0x0e")).toThrow(
      InvalidCadenceError,
    );
    expect(() => cadenceFromForm("every_n_days", "1e1")).toThrow(
      InvalidCadenceError,
    );
    expect(() => cadenceFromForm("every_n_days", " 14 ")).toThrow(
      InvalidCadenceError,
    );
  });

  it("fails loud on no-argument kind + days and unknown kind", () => {
    expect(() => cadenceFromForm("weekly", "14")).toThrow(InvalidCadenceError);
    expect(() => cadenceFromForm("not_a_kind", null)).toThrow(
      InvalidCadenceError,
    );
  });
});
