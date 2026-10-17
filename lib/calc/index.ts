import { computeMetrics, type LineStatus, type StoreMetrics } from "./metrics";
import { CalcError } from "./products";
import type { StoreData } from "./types";
import { computeWarnings, type StoreWarning } from "./warnings";

export * from "./assets";
export * from "./expenses";
export * from "./materials";
export * from "./metrics";
export * from "./overrides";
export * from "./pricing";
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

const STATUS_RANK: Record<LineStatus, number> = { red: 0, yellow: 1, green: 2 };

/** The most serious status among lines, or null when there are none. */
export function worstStatus(lines: { status: LineStatus }[]): LineStatus | null {
  return lines.reduce<LineStatus | null>(
    (worst, line) => (worst === null || STATUS_RANK[line.status] < STATUS_RANK[worst] ? line.status : worst),
    null,
  );
}

export type AnalysisResult = { analysis: StoreAnalysis; error: null } | { analysis: null; error: CalcError };

/** analyzeStore that returns a CalcError instead of throwing, so pages can say what to fix. */
export function tryAnalyzeStore(data: StoreData): AnalysisResult {
  try {
    return { analysis: analyzeStore(data), error: null };
  } catch (error) {
    if (error instanceof CalcError) return { analysis: null, error };
    throw error;
  }
}
