import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import { fixture } from "./fixture";

const codes = (data: StoreData) => analyzeStore(data).warnings.map((w) => w.code);

describe("warnings", () => {
  it("flags the fixture: no owner salary, online below target", () => {
    expect(analyzeStore(fixture()).warnings).toEqual([
      { code: "NO_OWNER_SALARY", lines: [] },
      { code: "BELOW_TARGET", lines: [{ productId: "eskopi", channelId: "online" }] },
    ]);
  });

  it("NO_OWNER_SALARY disappears once the owner's salary is a cost", () => {
    const data = fixture();
    data.expenses.push({ id: "e3", name: "Gaji saya", category: "gaji_pemilik", amount: 100000, frequency: "bulanan" });
    expect(codes(data)).not.toContain("NO_OWNER_SALARY");
  });

  it("NET_LOSS when fixed costs exceed gross profit", () => {
    const data = fixture();
    data.expenses[0] = { ...data.expenses[0], amount: 10000000 };
    expect(codes(data)[0]).toBe("NET_LOSS");
  });

  it("LOSS_PRODUCTS lists the red lines", () => {
    const data = fixture();
    data.prices[0] = { ...data.prices[0], price: 5000 };
    const warning = analyzeStore(data).warnings.find((w) => w.code === "LOSS_PRODUCTS");
    expect(warning?.lines).toEqual([{ productId: "eskopi", channelId: "offline" }]);
  });

  it("NEGATIVE_CONTRIBUTION when sales lose money on average", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000 }));
    expect(codes(data)).toEqual(expect.arrayContaining(["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION"]));
  });

  it("COMPETITOR_GAP above 25% difference, not at exactly 25%", () => {
    const far = fixture();
    far.prices[1] = { ...far.prices[1], competitorPrice: 12000 };
    expect(codes(far)).toContain("COMPETITOR_GAP");

    const edge = fixture();
    edge.prices[1] = { ...edge.prices[1], competitorPrice: 16000 };
    expect(codes(edge)).not.toContain("COMPETITOR_GAP");

    const zero = fixture();
    zero.prices[1] = { ...zero.prices[1], competitorPrice: 0 };
    expect(codes(zero)).not.toContain("COMPETITOR_GAP");
  });

  it("NO_SALES_ESTIMATE when nothing is expected to sell", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    expect(codes(data)).toContain("NO_SALES_ESTIMATE");
  });

  it("keeps the documented order", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000, competitorPrice: 20000 }));
    expect(codes(data)).toEqual(["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION", "NO_OWNER_SALARY", "COMPETITOR_GAP"]);
  });
});
