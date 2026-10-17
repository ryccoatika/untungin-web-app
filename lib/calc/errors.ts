export type CalcErrorCode = "UNIT_DIMENSION_MISMATCH" | "UNKNOWN_MATERIAL" | "SPOON_WEIGHT_MISSING";

/** Data the app should never have saved; thrown instead of calculating silently (spec §4.2 item 2). */
export class CalcError extends Error {
  constructor(
    readonly code: CalcErrorCode,
    readonly productId: string,
    readonly materialId: string,
  ) {
    super(`${code}: product ${productId}, material ${materialId}`);
    this.name = "CalcError";
  }
}
