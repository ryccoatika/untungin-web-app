import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ isLoggedIn: false }));

vi.mock("@/lib/supabase/proxy", () => ({
  refreshSession: async () => ({
    isLoggedIn: session.isLoggedIn,
    apply: <T extends import("next/server").NextResponse>(r: T): T => {
      r.cookies.set("sb-test", "1");
      r.headers.set("Cache-Control", "private, no-store");
      return r;
    },
  }),
}));

import { proxy } from "@/proxy";

function location(res: Response): URL | null {
  const value = res.headers.get("location");
  return value ? new URL(value) : null;
}

describe("proxy", () => {
  beforeEach(() => {
    session.isLoggedIn = false;
  });

  it("treats a percent-encoded protected path as protected", async () => {
    const res = await proxy(new NextRequest("http://localhost/id/%74oko"));
    expect(res.status).toBe(307);
    expect(location(res)!.pathname).toBe("/id/login");
    expect(res.headers.get("location")).toContain("next=");
  });

  // next-intl strips decoded TAB/LF/CR and collapses "//" before rewriting, so these all render protected pages.
  it.each([
    "/id/%09toko",
    "/%09id/toko",
    "/id/to%0Ako",
    "/id/onboarding%0D",
    "/en//toko",
    "/id/s/abc%0D/dashboard",
  ])("redirects %s to login when signed out", async (path) => {
    const res = await proxy(new NextRequest(`http://localhost${path}`));
    expect(res.status).toBe(307);
    const url = location(res)!;
    expect(url.pathname).toMatch(/^\/(id|en)\/login$/);
    expect(url.searchParams.get("next")).not.toMatch(/[\t\n\r]|%0[9ad]/i);
  });

  it("sends next as the sanitized path the page would have rendered", async () => {
    const res = await proxy(new NextRequest("http://localhost/id/%09toko?x=1"));
    expect(location(res)!.searchParams.get("next")).toBe("/id/toko?x=1");
  });

  it("lets a signed-out visitor through to public pages", async () => {
    const res = await proxy(new NextRequest("http://localhost/id/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects a signed-in user away from an obfuscated login path", async () => {
    session.isLoggedIn = true;
    const res = await proxy(new NextRequest("http://localhost/en/log%09in"));
    expect(res.status).toBe(307);
    expect(location(res)!.pathname).toBe("/en/mulai");
  });

  it("lets a signed-in user through to protected pages", async () => {
    session.isLoggedIn = true;
    const res = await proxy(new NextRequest("http://localhost/id/toko"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("keeps cookies and no-store headers on the next-intl redirect", async () => {
    const res = await proxy(new NextRequest("http://localhost/"));
    expect(location(res)!.pathname).toBe("/id");
    expect(res.cookies.get("sb-test")?.value).toBe("1");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("passes /auth/ through with cookies applied", async () => {
    const res = await proxy(new NextRequest("http://localhost/auth/callback?code=x"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("sb-test")?.value).toBe("1");
  });
});
