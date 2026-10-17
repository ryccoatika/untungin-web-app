import { describe, expect, it } from "vitest";
import { CHANNEL_TEMPLATES, findTemplate } from "@/lib/config/channel-templates";
import { channelInputSchema } from "@/lib/validation/channel";

describe("channel templates", () => {
  it("lists the spec's templates with unique keys and names", () => {
    expect(CHANNEL_TEMPLATES.map((t) => t.name)).toEqual([
      "Offline – QRIS",
      "GoFood",
      "GrabFood",
      "ShopeeFood",
      "Shopee",
      "Tokopedia",
      "TikTok Shop",
    ]);
    expect(new Set(CHANNEL_TEMPLATES.map((t) => t.key)).size).toBe(CHANNEL_TEMPLATES.length);
  });

  it("every template passes channel validation", () => {
    for (const template of CHANNEL_TEMPLATES) {
      expect(
        channelInputSchema.safeParse({
          name: template.name,
          commissionPct: String(template.commissionPct),
          fixedFee: String(template.fixedFee),
        }).success,
        template.key,
      ).toBe(true);
    }
  });

  it("finds a template by key", () => {
    expect(findTemplate("gofood")).toMatchObject({ name: "GoFood", commissionPct: 20, fixedFee: 1000 });
    expect(findTemplate("nope")).toBeUndefined();
  });
});
