import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({
  refreshSession: async () => ({
    isLoggedIn: false,
    apply: <T extends import("next/server").NextResponse>(r: T): T => {
      r.cookies.set("sb-test", "1");
      r.headers.set("Cache-Control", "private, no-store");
      return r;
    },
  }),
}));

import { proxy } from "@/proxy";

describe("proxy", () => {
  it("treats a percent-encoded protected path as protected", async () => {
    const res = await proxy(new NextRequest("http://localhost/id/%74oko"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/id/login");
    expect(res.headers.get("location")).toContain("next=");
  });

  it("keeps cookies and no-store headers on the next-intl redirect", async () => {
    const res = await proxy(new NextRequest("http://localhost/"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/id");
    expect(res.cookies.get("sb-test")?.value).toBe("1");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("passes /auth/ through with cookies applied", async () => {
    const res = await proxy(new NextRequest("http://localhost/auth/callback?code=x"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("sb-test")?.value).toBe("1");
  });
});
