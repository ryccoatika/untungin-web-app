import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisual } from "@/components/landing/hero-visual";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { routing, type AppLocale } from "@/i18n/routing";
import { publicPageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const FEATURES = ["hpp", "price", "profit"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return publicPageMetadata(locale, "", t("title"), t("description"));
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("Landing");
  const tp = await getTranslations("Privacy");
  const tt = await getTranslations("Terms");
  const tm = await getTranslations("Metadata");
  const locale = (await getLocale()) as AppLocale;
  const { akun } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-4 py-12 lg:py-16">
      <script
        type="application/ld+json"
        // Structured data for search engines; "<" is escaped so the JSON cannot close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            url: `${SITE_URL}/${locale}`,
            description: tm("description"),
            inLanguage: locale,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
          }).replace(/</g, "\\u003c"),
        }}
      />
      {!loggedIn && akun === "dihapus" && (
        <p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          {t("accountDeleted")}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("heading")}</h1>
          <p className="text-lg text-muted-foreground">{t("intro")}</p>
          <Link
            href={loggedIn ? "/mulai" : "/login"}
            className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
          >
            {loggedIn ? t("openApp") : t("startFree")}
          </Link>
        </div>
        <HeroVisual />
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature} className="rounded-lg border p-4">
            <p className="font-medium">{t(`features.${feature}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`features.${feature}.body`)}</p>
          </li>
        ))}
      </ul>
      <footer className="flex flex-wrap gap-x-4">
        <Link href="/privasi" className="inline-flex min-h-10 items-center text-sm underline underline-offset-4">
          {tp("link")}
        </Link>
        <Link href="/syarat" className="inline-flex min-h-10 items-center text-sm underline underline-offset-4">
          {tt("link")}
        </Link>
      </footer>
    </main>
  );
}
