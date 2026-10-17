import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ error: null as Error | null, savedLocale: null as string | null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () =>
        auth.error ? { data: { user: null }, error: auth.error } : { data: { user: { id: "user-1" } }, error: null },
    },
  }),
}));
vi.mock("@/lib/i18n/saved-locale", () => ({ getSavedLocale: async () => auth.savedLocale }));

import { GET } from "@/app/auth/callback/route";

async function callback(query: string): Promise<string> {
  const res = await GET(new NextRequest(`http://localhost:3000/auth/callback${query}`));
  expect(res.status).toBe(307);
  const location = new URL(res.headers.get("location")!);
  expect(location.origin).toBe("http://localhost:3000");
  return location.pathname + location.search;
}

describe("OAuth callback", () => {
  beforeEach(() => {
    auth.error = null;
    auth.savedLocale = null;
  });

  it("follows a safe next path", async () => {
    expect(await callback("?code=c&next=%2Fid%2Ftoko")).toBe("/id/toko");
  });

  it("falls back to /mulai without a next path", async () => {
    expect(await callback("?code=c")).toBe("/mulai");
  });

  it.each(["https://evil.example/x", "//evil.example/x", "/\\evil.example"])("ignores the unsafe next %s", async (next) => {
    expect(await callback(`?code=c&next=${encodeURIComponent(next)}`)).toBe("/mulai");
  });

  it("applies the language saved on the profile", async () => {
    auth.savedLocale = "en";
    expect(await callback("?code=c&next=%2Fid%2Ftoko%3Fx%3D1")).toBe("/en/toko?x=1");
  });

  it("returns to login keeping the language and next path when the exchange fails", async () => {
    auth.error = new Error("bad code");
    expect(await callback("?code=c&next=%2Fen%2Ftoko")).toBe("/en/login?error=auth&next=%2Fen%2Ftoko");
  });

  it("returns to the Indonesian login without a code", async () => {
    expect(await callback("")).toBe("/id/login?error=auth");
  });
});
