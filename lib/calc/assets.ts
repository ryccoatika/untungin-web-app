import type { CalcAsset } from "./types";

export function assetValue(asset: Pick<CalcAsset, "qty" | "unitPrice">): number {
  return asset.qty * asset.unitPrice;
}

export function assetMonthlyDepreciation(asset: Pick<CalcAsset, "qty" | "unitPrice" | "usefulLifeMonths">): number {
  return assetValue(asset) / asset.usefulLifeMonths;
}

/** Straight-line depreciation of all assets per month (spec §4.2 item 3). */
export function monthlyDepreciation(assets: CalcAsset[]): number {
  return assets.reduce((sum, asset) => sum + assetMonthlyDepreciation(asset), 0);
}

/** Initial capital for the payback period (spec §3.6). */
export function totalCapital(assets: CalcAsset[]): number {
  return assets.reduce((sum, asset) => sum + assetValue(asset), 0);
}
