import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { languageAlternates, PUBLIC_PATHS, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      alternates: { languages: languageAlternates(path, SITE_URL) },
    })),
  );
}
