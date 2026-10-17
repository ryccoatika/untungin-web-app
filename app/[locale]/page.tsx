import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisual } from "@/components/landing/hero-visual";
import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const FEATURES = ["hpp", "price", "profit"] as const;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("Landing");
  const tp = await getTranslations("Privacy");
  const { akun } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-4 py-12 lg:py-16">
      {akun === "dihapus" && (
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
      <footer>
        <Link href="/privasi" className="inline-flex min-h-10 items-center text-sm underline-offset-4 hover:underline">
          {tp("link")}
        </Link>
      </footer>
    </main>
  );
}
