import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { withLocale } from "@/lib/i18n/paths";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("Auth");
  const { next: rawNext, error } = await searchParams;
  const next = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  const target = withLocale(
    safeNextPath(next) ?? DEFAULT_AFTER_LOGIN,
    hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="inline-flex min-h-10 items-center rounded-md">
          <BrandLogo size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {t("error")}
        </p>
      )}
      <GoogleSignInButton next={target} />
      <p className="text-center text-xs text-muted-foreground">
        {t.rich("agreement", {
          terms: (chunks) => (
            <Link href="/syarat" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/privasi" className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
