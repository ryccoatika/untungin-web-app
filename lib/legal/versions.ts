/** Versions of the legal texts a user agrees to; bump one to ask everyone to agree again. */
export const TERMS_VERSION = "2026-10-18";
export const AI_TERMS_VERSION = "2026-10-18";

export type ConsentKind = "terms" | "ai";

export function currentVersion(kind: ConsentKind): string {
  return kind === "terms" ? TERMS_VERSION : AI_TERMS_VERSION;
}
