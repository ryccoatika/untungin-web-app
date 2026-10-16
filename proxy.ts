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

  // Unprefixed or non-canonical paths get a next-intl redirect; the follow-up request is checked then.
  const response = handleI18nRouting(request);
  if (response.headers.has("location")) return session.apply(response);

  // Match auth rules on the path next-intl will render, not on the raw URL: it decodes the path,
  // strips control/space characters and collapses "//" (e.g. "/id/%09toko" renders /id/toko).
  const routed = routedPathname(response, pathname);
  const { locale, rest } = splitLocale(safeDecode(routed));
  if (locale) {
    if (!session.isLoggedIn && isProtectedPath(rest)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = `?next=${encodeURIComponent(routed + search)}`;
      return session.apply(NextResponse.redirect(url));
    }
    if (session.isLoggedIn && rest === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${DEFAULT_AFTER_LOGIN}`;
      url.search = "";
      return session.apply(NextResponse.redirect(url));
    }
  }

  return session.apply(response);
}

/** The pathname a next-intl response renders: its rewrite target, else the request's own. */
function routedPathname(response: NextResponse, pathname: string): string {
  const rewrite = response.headers.get("x-middleware-rewrite");
  return rewrite ? new URL(rewrite).pathname : pathname;
}

function safeDecode(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname; // malformed escapes: next-intl already forwarded these to Next.js, which 400s
  }
}

export const config = {
  // All pathnames except Next internals, Vercel internals, and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
