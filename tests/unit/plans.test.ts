import { describe, expect, it } from "vitest";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";

describe("plans", () => {
  it("has the limits from the spec", () => {
    expect(PLAN_LIMITS).toEqual({
      free: { maxStores: 2, aiAnalysesPerDay: 3 },
      pro: { maxStores: 10, aiAnalysesPerDay: 20 },
    });
  });

  it.each([
    ["free", 0, true],
    ["free", 1, true],
    ["free", 2, false],
    ["pro", 9, true],
    ["pro", 10, false],
  ] as const)("%s with %d stores → %s", (plan, count, expected) => {
    expect(canCreateStore(plan, count)).toBe(expected);
  });

  it.each([
    ["pro", "pro"],
    ["free", "free"],
    ["enterprise", "free"],
    [null, "free"],
    [undefined, "free"],
  ])("toPlan(%j) → %s", (value, expected) => {
    expect(toPlan(value)).toBe(expected);
  });
});
