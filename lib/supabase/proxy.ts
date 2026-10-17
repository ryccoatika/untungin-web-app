import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "./database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Collects the cookies and headers Supabase wants to set during a request.
 * Request cookies are updated immediately (so downstream Server Components see a
 * refreshed session); `apply` copies everything onto whatever response the proxy
 * finally returns (next, rewrite, or redirect).
 */
export function createCookieCollector(request: NextRequest) {
  const cookies: CookieToSet[] = [];
  const headers: Record<string, string> = {};

  return {
    setAll(cookiesToSet: CookieToSet[], cacheHeaders: Record<string, string>) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      cookies.push(...cookiesToSet);
      Object.assign(headers, cacheHeaders);
    },
    apply<T extends NextResponse>(response: T): T {
      cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      // Auth-cookie responses must not be cached by CDNs/proxies.
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    },
  };
}

/** Refreshes the Supabase session for this request and reports whether a user is signed in. */
export async function refreshSession(request: NextRequest) {
  const collector = createCookieCollector(request);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          collector.setAll(cookiesToSet, cacheHeaders);
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  return { isLoggedIn: Boolean(data?.claims), apply: collector.apply };
}
