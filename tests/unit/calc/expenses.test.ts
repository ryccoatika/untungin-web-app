import { describe, expect, it } from "vitest";
import { monthlyAmount, monthlyExpenses } from "@/lib/calc/expenses";
import { fixture } from "./fixture";

describe("monthlyAmount", () => {
  it.each([
    ["harian", 10000, 260000],
    ["mingguan", 12000, 52000],
    ["bulanan", 1500000, 1500000],
    ["tahunan", 600000, 50000],
  ] as const)("%s Rp%d → Rp%d per month (26 days)", (frequency, amount, expected) => {
    expect(monthlyAmount({ amount, frequency }, 26)).toBeCloseTo(expected, 6);
  });

  it("uses the store's operating days for daily costs", () => {
    expect(monthlyAmount({ amount: 10000, frequency: "harian" }, 30)).toBe(300000);
  });
});

describe("monthlyExpenses", () => {
  it("sums normalized costs", () => {
    expect(monthlyExpenses(fixture().expenses, 26)).toBeCloseTo(1550000, 6);
  });

  it("is 0 without costs", () => {
    expect(monthlyExpenses([], 26)).toBe(0);
  });
});
