import { describe, expect, it } from "vitest";
import { CalcError, tryAnalyzeStore, worstStatus } from "@/lib/calc";
import { fixture } from "./fixture";

describe("tryAnalyzeStore", () => {
  it("returns the analysis", () => {
    const result = tryAnalyzeStore(fixture());
    expect(result.error).toBeNull();
    expect(result.analysis?.netProfit).toBeCloseTo(3030000, 6);
  });

  it("returns a CalcError instead of throwing", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    const result = tryAnalyzeStore(data);
    expect(result.analysis).toBeNull();
    expect(result.error).toBeInstanceOf(CalcError);
    expect(result.error).toMatchObject({ code: "UNIT_DIMENSION_MISMATCH", productId: "eskopi" });
  });
});

describe("worstStatus", () => {
  it.each([
    [[], null],
    [["green"], "green"],
    [["green", "yellow"], "yellow"],
    [["green", "red", "yellow"], "red"],
  ] as const)("%j → %s", (statuses, expected) => {
    expect(worstStatus(statuses.map((status) => ({ status })))).toBe(expected);
  });
});
