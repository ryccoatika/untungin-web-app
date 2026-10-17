import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnalysis, type AnalyzeDeps } from "@/lib/ai/analyze";
import { snapshotHash, type AnalysisSnapshot } from "@/lib/ai/snapshot";

const P = "00000000-0000-4000-8000-00000000000a";
const C = "00000000-0000-4000-8000-00000000000c";

const snapshot = {
  locale: "id",
  store: { name: "Toko", businessType: "minuman", targetMarket: null, targetMarginPct: 40, operatingDaysPerMonth: 26 },
  channels: [{ id: C, name: "Tunai", commissionPct: 0, fixedFee: 0 }],
  materials: [],
  products: [{ id: P, name: "Es teh", lines: [{ channelId: C, price: 5000, competitorPrice: null, estMonthlySales: 600, materialCost: 300, fullCost: 1967, netPrice: 5000, contribution: 4700, marginPct: 60.7, targetMarginPct: 40, status: "green" }] }],
  totals: {
    grossRevenue: 3000000, netRevenue: 3000000, materialCosts: 180000, netProfit: 1820000, netMarginPct: 60.7, totalUnits: 600,
    fixedCosts: { byCategory: { sewa: 1000000 }, depreciation: 0, total: 1000000 },
    bepUnitsMonthly: 213, bepUnitsDaily: 9, totalCapital: 0, paybackMonths: null,
  },
  warnings: [{ code: "NO_OWNER_SALARY", lines: [] }],
} satisfies AnalysisSnapshot;

const answer = {
  summary: "Usahamu untung.",
  highlights: ["Es teh laku."],
  issues: [{ title: "Gaji", explanation: "Catat gajimu.", related_product_ids: [P, "nope"], priority: "tinggi" }],
  recommendations: [{ action: "Naikkan harga", reason: "Margin.", simulation: { type: "change_price", product_id: P, channel_id: C, new_price: 6000 } }],
};

function deps(overrides: Partial<AnalyzeDeps> = {}): AnalyzeDeps {
  return {
    latestHash: vi.fn(async () => null),
    claimUsage: vi.fn(async () => "usage-1"),
    refundUsage: vi.fn(async () => {}),
    generate: vi.fn(async () => JSON.stringify(answer)),
    save: vi.fn(async () => {}),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("runAnalysis", () => {
  it("does not put any model text in the logs when the answer is not JSON", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ generate: vi.fn(async () => "Maaf, saya tidak bisa") });
    expect(await runAnalysis(d, snapshot)).toBe("failed");
    expect(d.refundUsage).toHaveBeenCalledWith("usage-1");
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain("Maaf");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("saya tidak");
  });

  it("fails without claiming or refunding when reading the latest hash fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ latestHash: vi.fn(async () => { throw new Error("db down"); }) });
    expect(await runAnalysis(d, snapshot)).toBe("failed");
    expect(d.claimUsage).not.toHaveBeenCalled();
    expect(d.refundUsage).not.toHaveBeenCalled();
  });

  it("returns the saved result without calling the AI when the data is unchanged", async () => {
    const d = deps({ latestHash: vi.fn(async () => snapshotHash(snapshot)) });
    expect(await runAnalysis(d, snapshot)).toBe("cached");
    expect(d.claimUsage).not.toHaveBeenCalled();
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("refuses when the quota is used up, without calling the AI", async () => {
    const d = deps({ claimUsage: vi.fn(async () => null) });
    expect(await runAnalysis(d, snapshot)).toBe("quota");
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.refundUsage).not.toHaveBeenCalled();
  });

  it("saves a valid answer with unknown ids removed", async () => {
    const d = deps({ latestHash: vi.fn(async () => "older-hash") });
    expect(await runAnalysis(d, snapshot)).toBe("created");
    expect(d.save).toHaveBeenCalledWith({
      snapshotHash: snapshotHash(snapshot),
      snapshot,
      output: { ...answer, issues: [{ ...answer.issues[0], related_product_ids: [P] }] },
    });
    expect(d.refundUsage).not.toHaveBeenCalled();
  });

  it("sends the prompt in the snapshot's language with the response schema", async () => {
    const d = deps();
    await runAnalysis(d, snapshot);
    const request = vi.mocked(d.generate).mock.calls[0][0];
    expect(request.system).toContain("Bahasa Indonesia");
    expect(request.prompt).toContain('"name":"Es teh"');
    expect(request.schema).toHaveProperty("required");
  });

  it.each([
    ["the AI call throws (timeout, network)", { generate: vi.fn(async () => { throw new Error("timeout"); }) }],
    ["the answer is not JSON", { generate: vi.fn(async () => "Maaf, saya tidak bisa") }],
    ["the answer has the wrong shape", { generate: vi.fn(async () => JSON.stringify({ summary: 1 })) }],
    ["saving fails", { save: vi.fn(async () => { throw new Error("db down"); }) }],
  ])("fails and gives the quota back when %s", async (_label, override) => {
    const d = deps(override as Partial<AnalyzeDeps>);
    expect(await runAnalysis(d, snapshot)).toBe("failed");
    expect(d.refundUsage).toHaveBeenCalledWith("usage-1");
  });

  it("fails without a refund when claiming the quota itself fails", async () => {
    const d = deps({ claimUsage: vi.fn(async () => { throw new Error("db down"); }) });
    expect(await runAnalysis(d, snapshot)).toBe("failed");
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.refundUsage).not.toHaveBeenCalled();
  });

  it("still reports the failure when the refund fails too", async () => {
    const d = deps({
      generate: vi.fn(async () => { throw new Error("timeout"); }),
      refundUsage: vi.fn(async () => { throw new Error("db down"); }),
    });
    expect(await runAnalysis(d, snapshot)).toBe("failed");
  });
});
