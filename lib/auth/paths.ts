const PROTECTED_PREFIXES = ["/s", "/onboarding", "/toko", "/mulai"] as const;

export const DEFAULT_AFTER_LOGIN = "/mulai";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Returns a same-origin path to redirect to, or null if `next` is unsafe. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  const base = "http://app.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    // Dot-segments normalize away (e.g. "/.//x" -> "//x"); re-check the result.
    const result = `${url.pathname}${url.search}${url.hash}`;
    if (result.startsWith("//") || result.startsWith("/\\")) return null;
    return result;
  } catch {
    return null;
  }
}
