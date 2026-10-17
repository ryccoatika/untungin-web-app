import { computeMetrics, type StoreMetrics } from "./metrics";
import type { StoreData } from "./types";
import { computeWarnings, type StoreWarning } from "./warnings";

export * from "./assets";
export * from "./expenses";
export * from "./materials";
export * from "./metrics";
export * from "./products";
export * from "./types";
export * from "./units";
export * from "./warnings";

export type StoreAnalysis = StoreMetrics & { warnings: StoreWarning[] };

/** Metrics plus warnings for one store; throws CalcError on data the app should never have saved. */
export function analyzeStore(data: StoreData): StoreAnalysis {
  const metrics = computeMetrics(data);
  return { ...metrics, warnings: computeWarnings(data, metrics) };
}
