import { getTranslations } from "next-intl/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { DevLoginForm } from "./dev-login-form";
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
  const target = safeNextPath(next) ?? `/${locale}${DEFAULT_AFTER_LOGIN}`;
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
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
      {devLogin && <DevLoginForm next={target} />}
    </main>
  );
}
