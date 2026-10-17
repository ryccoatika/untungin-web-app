export type ChannelTemplate = { key: string; name: string; commissionPct: number; fixedFee: number };

/**
 * Typical seller fees, verified October 2026 (spec §3.4). The UI marks them as estimates: fees vary by
 * category, promotions and PPN, so sellers should check their merchant dashboard. Names are brand
 * names, identical in every locale, so they are stored as-is when a template is added.
 */
export const CHANNEL_TEMPLATES: readonly ChannelTemplate[] = [
  // BI: QRIS MDR is 0% for micro businesses up to Rp500.000 per transaction from 1 Oct 2026.
  { key: "qris", name: "Offline – QRIS", commissionPct: 0, fixedFee: 0 },
  { key: "gofood", name: "GoFood", commissionPct: 20, fixedFee: 1000 },
  { key: "grabfood", name: "GrabFood", commissionPct: 30, fixedFee: 0 },
  { key: "shopeefood", name: "ShopeeFood", commissionPct: 20, fixedFee: 0 },
  { key: "shopee", name: "Shopee", commissionPct: 9, fixedFee: 1250 },
  { key: "tokopedia", name: "Tokopedia", commissionPct: 8, fixedFee: 0 },
  { key: "tiktokshop", name: "TikTok Shop", commissionPct: 8, fixedFee: 0 },
];

export function findTemplate(key: string): ChannelTemplate | undefined {
  return CHANNEL_TEMPLATES.find((template) => template.key === key);
}
