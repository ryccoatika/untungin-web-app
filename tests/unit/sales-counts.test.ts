import { describe, expect, it } from "vitest";
import { parseSalesCounts } from "@/lib/records";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";
const known = [
  { productId: P1, channelId: C1 },
  { productId: P2, channelId: C1 },
];

describe("parseSalesCounts", () => {
  it("accepts known pairs with whole quantities 0–9999", () => {
    const counts = [
      { productId: P1, channelId: C1, qty: 0 },
      { productId: P2, channelId: C1, qty: 9999 },
    ];
    expect(parseSalesCounts(counts, known)).toEqual(counts);
    expect(parseSalesCounts([], known)).toEqual([]);
  });

  it.each([
    ["not an array", "x"],
    ["null item", [null]],
    ["null product id", [{ productId: null, channelId: C1, qty: 1 }]],
    ["malformed uuid", [{ productId: "abc", channelId: C1, qty: 1 }]],
    ["pair not in the priced active list", [{ productId: P1, channelId: P2, qty: 1 }]],
    ["negative qty", [{ productId: P1, channelId: C1, qty: -1 }]],
    ["fractional qty", [{ productId: P1, channelId: C1, qty: 1.5 }]],
    ["qty above the cap", [{ productId: P1, channelId: C1, qty: 10000 }]],
    ["numeric string qty", [{ productId: P1, channelId: C1, qty: "3" }]],
    ["NaN qty", [{ productId: P1, channelId: C1, qty: NaN }]],
    ["duplicate pair", [{ productId: P1, channelId: C1, qty: 1 }, { productId: P1, channelId: C1, qty: 2 }]],
  ])("refuses %s", (_name, input) => {
    expect(parseSalesCounts(input, known)).toBeNull();
  });
});
