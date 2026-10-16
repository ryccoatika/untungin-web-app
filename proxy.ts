import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { DEFAULT_AFTER_LOGIN, isProtectedPath } from "@/lib/auth/paths";
import { splitLocale } from "@/lib/i18n/paths";
import { refreshSession } from "@/lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // Refresh first so the refreshed cookies are in `request` before next-intl copies its headers.
  const session = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  // The OAuth callback lives outside [locale] so its redirect URI never changes.
  if (pathname.startsWith("/auth/")) return session.apply(NextResponse.next({ request }));

  const { locale, rest } = splitLocale(pathname);
  if (locale) {
    if (!session.isLoggedIn && isProtectedPath(rest)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return session.apply(NextResponse.redirect(url));
    }
    if (session.isLoggedIn && rest === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${DEFAULT_AFTER_LOGIN}`;
      url.search = "";
      return session.apply(NextResponse.redirect(url));
    }
  }

  // Unprefixed paths are redirected by next-intl to the detected locale.
  return session.apply(handleI18nRouting(request));
}

export const config = {
  // All pathnames except Next internals, Vercel internals, and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
