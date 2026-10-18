import { currentVersion, type ConsentKind } from "@/lib/legal/versions";

/** True when the user agreed to the current version of this kind. */
export function hasAgreed(rows: { kind: string; version: string }[], kind: ConsentKind): boolean {
  return rows.some((row) => row.kind === kind && row.version === currentVersion(kind));
}

/** True when the user has no `terms` row at all, whatever its version: a version bump is not a first sign-in. */
export function isFirstSignIn(rows: { kind: string }[]): boolean {
  return !rows.some((row) => row.kind === "terms");
}
