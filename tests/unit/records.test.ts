import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import {
  addDays,
  daysInMonth,
  earliestRecordable,
  isIsoDate,
  isIsoMonth,
  jakartaToday,
  missingDates,
  monthOf,
  monthReport,
  newPurchasePrice,
  snapshotLines,
  type SalesLineRecord,
} from "@/lib/records";

/** Kopi: price 22.000 offline (HPP 6.200), 27.000 GoFood 20% + Rp1.000 (HPP 6.700). Fixed costs 3.100.000. */
function store(): StoreData {
  return {
    store: { id: "s", name: "Kedai", targetMarginPct: 40, operatingDaysPerMonth: 26 },
    materials: [
      { id: "base", name: "Bahan", category: "bahan", purchaseQty: 1, purchaseUnit: "pcs", purchasePrice: 6200, wastePct: 0 },
      { id: "pack", name: "Kemasan", category: "kemasan", purchaseQty: 1, purchaseUnit: "pcs", purchasePrice: 500, wastePct: 0 },
    ],
    products: [
      { id: "kopi", name: "Kopi", yieldQty: 1, targetMarginPct: null, isActive: true },
      { id: "teh", name: "Teh", yieldQty: 1, targetMarginPct: null, isActive: true },
    ],
    composition: [
      { id: "r1", productId: "kopi", materialId: "base", qty: 1, unit: "pcs", basis: "unit", channelId: null },
      { id: "r2", productId: "kopi", materialId: "pack", qty: 1, unit: "pcs", basis: "unit", channelId: "gofood" },
      { id: "r3", productId: "teh", materialId: "base", qty: 1, unit: "pcs", basis: "unit", channelId: null },
    ],
    channels: [
      { id: "offline", name: "Offline", commissionPct: 0, fixedFee: 0 },
      { id: "gofood", name: "GoFood", commissionPct: 20, fixedFee: 1000 },
    ],
    prices: [
      { productId: "kopi", channelId: "offline", price: 22000, estMonthlySales: 300, competitorPrice: null },
      { productId: "kopi", channelId: "gofood", price: 27000, estMonthlySales: 100, competitorPrice: null },
      { productId: "teh", channelId: "offline", price: 8000, estMonthlySales: 0, competitorPrice: null },
    ],
    expenses: [{ id: "e1", name: "Sewa", category: "sewa", amount: 3_100_000, frequency: "bulanan" }],
    assets: [],
  };
}

function line(date: string, channel: "offline" | "gofood", qty: number, over: Partial<SalesLineRecord> = {}): SalesLineRecord {
  const off = channel === "offline";
  return {
    id: `${date}-${channel}`,
    date,
    productId: "kopi",
    channelId: channel,
    productName: "Kopi",
    channelName: off ? "Offline" : "GoFood",
    qty,
    unitPrice: off ? 22000 : 27000,
    netUnit: off ? 22000 : 20600,
    hppUnit: off ? 6200 : 6700,
    ...over,
  };
}

function report(month: string, today: string, firstRecord: string | null, lines: SalesLineRecord[], closedDays: string[] = []) {
  const data = store();
  const days = [...new Set([...lines.map((l) => l.date), ...closedDays])].map((date) => ({ date, closed: closedDays.includes(date) }));
  return monthReport({ month, today, firstRecord, days, lines, analysis: analyzeStore(data), data });
}

const octLines = [line("2026-10-01", "offline", 10), line("2026-10-01", "gofood", 5)];

describe("dates", () => {
  it("uses the Asia/Jakarta day", () => {
    expect(jakartaToday(new Date("2026-10-17T18:30:00Z"))).toBe("2026-10-18");
    expect(jakartaToday(new Date("2026-10-17T16:59:59Z"))).toBe("2026-10-17");
  });
  it("does calendar arithmetic", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(monthOf("2026-10-18")).toBe("2026-10");
    expect(earliestRecordable("2026-10-18")).toBe("2026-07-18");
  });
  it("validates formats", () => {
    expect(isIsoDate("2026-10-18")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate(20261018)).toBe(false);
    expect(isIsoMonth("2026-10")).toBe(true);
    expect(isIsoMonth("2026-13")).toBe(false);
  });
});

describe("missingDates", () => {
  const filled = new Set(
    [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 13, 14, 15, 16].map((d) => `2026-10-${String(d).padStart(2, "0")}`),
  );
  it("lists unfilled days before today", () => {
    expect(missingDates("2026-10-01", "2026-10-17", filled, "2026-10-01", "2026-10-31")).toEqual(["2026-10-08", "2026-10-12"]);
  });
  it("is empty without a first record", () => {
    expect(missingDates(null, "2026-10-17", filled, "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("starts at the first record", () => {
    expect(missingDates("2026-10-10", "2026-10-17", filled, "2026-10-01", "2026-10-31")).toEqual(["2026-10-12"]);
  });
});

describe("snapshotLines", () => {
  it("freezes price, net price and HPP bahan", () => {
    const data = store();
    const [offline, gofood] = snapshotLines(data, analyzeStore(data), [
      { productId: "kopi", channelId: "offline", qty: 3 },
      { productId: "kopi", channelId: "gofood", qty: 2 },
    ]);
    expect(offline).toMatchObject({ unitPrice: 22000, netUnit: 22000, hppUnit: 6200 });
    expect(gofood).toEqual({
      productId: "kopi",
      channelId: "gofood",
      productName: "Kopi",
      channelName: "GoFood",
      qty: 2,
      unitPrice: 27000,
      netUnit: 20600,
      hppUnit: 6700,
    });
  });
  it("throws for a pair without a price", () => {
    const data = store();
    expect(() => snapshotLines(data, analyzeStore(data), [{ productId: "teh", channelId: "gofood", qty: 1 }])).toThrow();
  });
});

describe("monthReport", () => {
  it("prorates fixed costs from the first record in the current month", () => {
    const r = report("2026-10", "2026-10-17", "2026-10-01", octLines);
    expect(r).toMatchObject({
      omzet: 355000,
      channelFees: 32000,
      materialCosts: 95500,
      grossProfit: 227500,
      fixedCosts: 1700000,
      netProfit: -1472500,
    });
    expect(r.window).toEqual({ start: "2026-10-01", end: "2026-10-17", days: 17 });
  });
  it("starts the window at a mid-month first record", () => {
    const r = report("2026-10", "2026-10-17", "2026-10-15", octLines);
    expect(r.window).toEqual({ start: "2026-10-15", end: "2026-10-17", days: 3 });
    expect(r.fixedCosts).toBe(300000);
    expect(r.netProfit).toBe(-72500);
  });
  it("uses the whole recorded part of a past month", () => {
    const r = report("2026-09", "2026-10-17", "2026-09-10", []);
    expect(r.window?.days).toBe(21);
    expect(r.fixedCosts).toBe(2170000);
  });
  it("has no window before the first record", () => {
    const r = report("2026-08", "2026-10-17", "2026-09-10", []);
    expect(r.window).toBeNull();
    expect(r.fixedCosts).toBe(0);
    expect(r.plannedNetProfit).toBeNull();
    expect(r.biggestGap).toBeNull();
    expect(r.calendar).toHaveLength(31);
    expect(r.calendar.every((d) => d.state === "before")).toBe(true);
  });
  it("has no window after today", () => {
    const r = report("2026-11", "2026-10-17", "2026-10-01", []);
    expect(r.window).toBeNull();
    expect(r.calendar.every((d) => d.state === "future")).toBe(true);
  });
  it("plans net profit for the window", () => {
    const data = store();
    const r = report("2026-10", "2026-10-17", "2026-10-01", octLines);
    expect(r.plannedNetProfit).toBe(Math.round((analyzeStore(data).netProfit * 17) / 31));
  });
  it("labels calendar days", () => {
    const lines = [...octLines, line("2026-10-02", "offline", 1)];
    const r = report("2026-10", "2026-10-17", "2026-10-01", lines, ["2026-10-03"]);
    const state = (d: number) => r.calendar.find((c) => c.date === `2026-10-${String(d).padStart(2, "0")}`)?.state;
    expect(state(1)).toBe("recorded");
    expect(state(3)).toBe("closed");
    expect(state(8)).toBe("missing");
    expect(state(17)).toBe("today");
    expect(state(18)).toBe("future");
    expect(r.missing).toContain("2026-10-08");
    expect(r.missing).not.toContain("2026-10-03");
  });
  it("keeps today recorded when it has a record", () => {
    const r = report("2026-10", "2026-10-17", "2026-10-01", [...octLines, line("2026-10-17", "offline", 1)]);
    expect(r.calendar.find((c) => c.date === "2026-10-17")?.state).toBe("recorded");
  });
  it("reconciles exactly with fractional snapshots", () => {
    const lines = [
      line("2026-10-01", "gofood", 7, { netUnit: 20599.6, hppUnit: 6213.33 }),
      line("2026-10-02", "gofood", 3, { netUnit: 20599.6, hppUnit: 6213.33 }),
      line("2026-10-02", "offline", 11, { netUnit: 21999.5, hppUnit: 6199.7 }),
    ];
    const r = report("2026-10", "2026-10-17", "2026-10-01", lines);
    expect(r.omzet - r.channelFees - r.materialCosts).toBe(r.grossProfit);
    expect(r.grossProfit - r.fixedCosts).toBe(r.netProfit);
    for (const v of [r.omzet, r.channelFees, r.materialCosts, r.grossProfit, r.fixedCosts, r.netProfit]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it("counts lines whose product was deleted", () => {
    const r = report("2026-10", "2026-10-17", "2026-10-01", [line("2026-10-01", "offline", 2, { productId: null, channelId: null })]);
    expect(r.omzet).toBe(44000);
  });
  it("picks the biggest Rupiah shortfall with a negative percentage", () => {
    // expected over 17/31 days: offline 300 → 164.5 units (contribution 15.800), GoFood 100 → 54.8 (13.900)
    const lines = [line("2026-10-01", "offline", 160), line("2026-10-01", "gofood", 10)];
    const gap = report("2026-10", "2026-10-17", "2026-10-01", lines).biggestGap;
    expect(gap).toEqual({
      productName: "Kopi",
      channelName: "GoFood",
      pct: Math.round(((10 - (100 * 17) / 31) / ((100 * 17) / 31)) * 100),
      rupiah: Math.round((10 - (100 * 17) / 31) * 13900),
    });
    expect(gap!.pct).toBeLessThan(0);
  });
  it("skips pairs with no expected sales", () => {
    const lines = [line("2026-10-01", "offline", 300), line("2026-10-01", "gofood", 100), line("2026-10-01", "offline", 50, { productId: "teh" })];
    const gap = report("2026-10", "2026-10-17", "2026-10-01", lines).biggestGap;
    expect(gap?.productName).toBe("Kopi");
  });
});

describe("newPurchasePrice", () => {
  it("scales the paid price to one purchase pack", () => {
    expect(newPurchasePrice({ purchaseQty: 1, purchaseUnit: "kg" }, 2, "kg", 34000)).toBe(17000);
    expect(newPurchasePrice({ purchaseQty: 1, purchaseUnit: "kg" }, 500, "g", 9000)).toBe(18000);
    expect(newPurchasePrice({ purchaseQty: 50, purchaseUnit: "pcs" }, 2, "lusin", 18000)).toBe(37500);
  });
  it("throws on a different dimension", () => {
    expect(() => newPurchasePrice({ purchaseQty: 1, purchaseUnit: "l" }, 2, "kg", 1)).toThrow();
  });
});
