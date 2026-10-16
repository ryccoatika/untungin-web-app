import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { createCookieCollector } from "@/lib/supabase/proxy";

describe("createCookieCollector", () => {
  it("updates the request and copies cookies + no-store headers onto any response", () => {
    const request = new NextRequest("http://localhost/id/toko");
    const collector = createCookieCollector(request);

    collector.setAll(
      [{ name: "sb-auth", value: "fresh", options: { path: "/", httpOnly: true } }],
      { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" },
    );

    expect(request.cookies.get("sb-auth")?.value).toBe("fresh");
    expect(request.headers.get("cookie")).toContain("sb-auth=fresh");

    const redirect = collector.apply(NextResponse.redirect("http://localhost/id/login"));
    expect(redirect.cookies.get("sb-auth")?.value).toBe("fresh");
    expect(redirect.headers.get("cache-control")).toContain("no-store");
    expect(redirect.headers.get("pragma")).toBe("no-cache");

    const next = collector.apply(NextResponse.next());
    expect(next.cookies.get("sb-auth")?.value).toBe("fresh");
  });

  it("leaves responses untouched when Supabase set nothing", () => {
    const collector = createCookieCollector(new NextRequest("http://localhost/id"));
    const response = collector.apply(NextResponse.next());
    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
