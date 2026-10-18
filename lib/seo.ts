import type { Metadata } from "next";
import { routing, type AppLocale } from "@/i18n/routing";

/** The production origin: canonical links, link previews, robots.txt and the sitemap all point here. */
export const SITE_URL = "https://untungin.ryccoatika.com";
export const SITE_NAME = "Untungin";

/** Pages anyone can open without signing in; `""` is the landing page. */
export const PUBLIC_PATHS = ["", "/privasi"] as const;

const OG_LOCALE: Record<AppLocale, string> = { id: "id_ID", en: "en_US" };

/** app/[locale]/opengraph-image.tsx: its size, and its URL for a locale. */
export const OG_IMAGE = { width: 1200, height: 630 } as const;
const ogImage = (locale: AppLocale) => ({ url: `/${locale}/opengraph-image`, ...OG_IMAGE, alt: SITE_NAME, type: "image/png" });

/**
 * Open Graph tags for a page in `locale`; `path` adds og:url. The [locale] segment gets its image from
 * opengraph-image.tsx, but a page that sets its own openGraph loses it, so `withImage` adds it back.
 */
export function openGraph(locale: AppLocale, title: string, description: string, path?: string, withImage = false): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: OG_LOCALE[locale],
    alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
    title,
    description,
    ...(path !== undefined && { url: `/${locale}${path}` }),
    ...(withImage && { images: [ogImage(locale)] }),
  };
}

/** The same path in every locale, plus x-default (the default locale). */
export function languageAlternates(path: string, origin = ""): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((locale) => [locale, `${origin}/${locale}${path}`])),
    "x-default": `${origin}/${routing.defaultLocale}${path}`,
  };
}

/**
 * Canonical and hreflang links plus link-preview tags for a public page. A segment's openGraph and twitter replace
 * the parent's, so this repeats every field rather than relying on the layout's.
 */
export function publicPageMetadata(locale: AppLocale, path: string, title: string, description: string): Metadata {
  return {
    description,
    alternates: { canonical: `/${locale}${path}`, languages: languageAlternates(path) },
    openGraph: openGraph(locale, title, description, path, true),
    twitter: { card: "summary_large_image", title, description, images: [ogImage(locale)] },
  };
}
