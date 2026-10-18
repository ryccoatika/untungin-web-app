import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in areas and the sign-in flow: nothing there for a search engine.
      disallow: ["/auth/", "/*/s/", "/*/login", "/*/mulai", "/*/onboarding", "/*/toko"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
