import type { StoreAnalysis, StoreData } from "@/lib/calc";
import type { IsoDate } from "./dates";

export type SalesCount = { productId: string; channelId: string; qty: number };

export type SalesLineSnapshot = {
  productId: string;
  channelId: string;
  productName: string;
  channelName: string;
  qty: number;
  unitPrice: number;
  netUnit: number;
  hppUnit: number;
};

/** Freezes today's price, net price and HPP bahan onto each counted pair. */
export function snapshotLines(data: StoreData, analysis: StoreAnalysis, counts: SalesCount[]): SalesLineSnapshot[] {
  return counts.map(({ productId, channelId, qty }) => {
    const line = analysis.lines.find((l) => l.productId === productId && l.channelId === channelId);
    const product = data.products.find((p) => p.id === productId);
    const channel = data.channels.find((c) => c.id === channelId);
    if (!line || !product || !channel) throw new Error(`No price line for product ${productId} in channel ${channelId}`);
    return {
      productId,
      channelId,
      productName: product.name,
      channelName: channel.name,
      qty,
      unitPrice: line.price,
      netUnit: line.netPrice,
      hppUnit: line.materialCost,
    };
  });
}

export type SalesDayRecord = { date: IsoDate; closed: boolean };

export type SalesLineRecord = {
  id: string;
  date: IsoDate;
  productId: string | null;
  channelId: string | null;
  productName: string;
  channelName: string;
  qty: number;
  unitPrice: number;
  netUnit: number;
  hppUnit: number;
};
