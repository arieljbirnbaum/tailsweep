import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CADENCE_KINDS,
  parseCadence,
  type CadenceInput,
  type CadenceKind,
} from "@/domain";

describe("CADENCE_KINDS", () => {
  it("is exactly the kind union of cadenceSchema (typecheck proof)", () => {
    expectTypeOf<(typeof CADENCE_KINDS)[number]>().toEqualTypeOf<CadenceKind>();
    expectTypeOf<CadenceInput["kind"]>().toEqualTypeOf<CadenceKind>();
  });

  it("has no duplicates", () => {
    expect(new Set(CADENCE_KINDS).size).toBe(CADENCE_KINDS.length);
  });

  it("every listed kind is accepted by the domain schema", () => {
    for (const kind of CADENCE_KINDS) {
      const input = kind === "every_n_days" ? { kind, days: 1 } : { kind };
      expect(parseCadence(input).kind).toBe(kind);
    }
  });
});
