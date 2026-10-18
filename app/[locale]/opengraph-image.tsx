import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { OG_IMAGE } from "@/lib/seo";

// The link preview image (og:image) for every page under /[locale]; X falls back to it for twitter:image.
export const alt = "Untungin";
export const size = { ...OG_IMAGE };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const FEATURES = ["hpp", "price", "profit"] as const;

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Landing" });
  // Geist (OFL), committed under assets/fonts so the image renders the same everywhere.
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          fontFamily: "Geist",
          color: "#0f172a",
          background: "linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%, #d1fae5 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {/* Same mark as components/brand-logo.tsx and app/icon.svg. */}
            <div
              style={{
                width: 96,
                height: 96,
                display: "flex",
                borderRadius: 22,
                background: "linear-gradient(135deg, #34d399 0%, #047857 100%)",
              }}
            >
              <svg width="96" height="96" viewBox="0 0 64 64">
                <g fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 19v14a11.5 11.5 0 0 0 23 0V17" />
                  <path d="M31.5 25.5 40 17l8.5 8.5" />
                </g>
                <circle cx="17" cy="19" r="3.5" fill="#fde68a" />
              </svg>
            </div>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: -1 }}>
              <span>Untung</span>
              <span style={{ color: "#059669" }}>in</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#475569" }}>untungin.ryccoatika.com</div>
        </div>

        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>
          {t("heading")}
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {FEATURES.map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: 999,
                border: "2px solid #a7f3d0",
                background: "#ffffff",
                color: "#065f46",
                fontSize: 28,
              }}
            >
              {t(`features.${feature}.title`)}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
