import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TERMS_VERSION } from "@/lib/legal/versions";

const auth = vi.hoisted(() => ({
  error: null as Error | null,
  savedLocale: null as string | null,
  consents: [] as { kind: string }[],
  selectError: null as Error | null,
  insertError: null as Error | null,
  inserts: [] as unknown[],
  log: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    // One client per request: consents must be read and written with the one that exchanged the code.
    let exchanged = false;
    const consents = {
      select: () => ({
        eq: async () => {
          auth.log.push(exchanged ? "select" : "select-before-exchange");
          return auth.selectError ? { data: null, error: auth.selectError } : { data: auth.consents, error: null };
        },
      }),
      insert: async (row: unknown) => {
        auth.log.push(exchanged ? "insert" : "insert-before-exchange");
        auth.inserts.push(row);
        return { error: auth.insertError };
      },
    };
    return {
      auth: {
        exchangeCodeForSession: async () => {
          exchanged = true;
          return auth.error ? { data: { user: null }, error: auth.error } : { data: { user: { id: "user-1" } }, error: null };
        },
      },
      from: (table: string) => {
        if (table !== "consents") throw new Error(`unexpected table ${table}`);
        return consents;
      },
    };
  },
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
    auth.consents = [];
    auth.selectError = null;
    auth.insertError = null;
    auth.inserts = [];
    auth.log = [];
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

  describe("recording the sign-in agreement", () => {
    it("records the current terms on the first sign-in, with the client that exchanged the code", async () => {
      expect(await callback("?code=c")).toBe("/mulai");
      expect(auth.inserts).toEqual([{ user_id: "user-1", kind: "terms", version: TERMS_VERSION }]);
      expect(auth.log).toEqual(["select", "insert"]);
    });

    it("adds nothing when the user already has a terms row, even an older version", async () => {
      auth.consents = [{ kind: "terms" }];
      expect(await callback("?code=c")).toBe("/mulai");
      expect(auth.inserts).toEqual([]);
    });

    it("records the terms when the user only agreed to the AI terms", async () => {
      auth.consents = [{ kind: "ai" }];
      await callback("?code=c");
      expect(auth.inserts).toHaveLength(1);
    });

    it.each([
      ["reading", "selectError"],
      ["saving", "insertError"],
    ] as const)("still signs in when %s the consent fails, logging only the message", async (_stage, key) => {
      auth[key] = new Error("db down");
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(await callback("?code=c&next=%2Fid%2Ftoko")).toBe("/id/toko");
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("db down"));
      logged.mockRestore();
    });

    it("records nothing when the exchange fails", async () => {
      auth.error = new Error("bad code");
      await callback("?code=c");
      expect(auth.log).toEqual([]);
    });
  });
});
