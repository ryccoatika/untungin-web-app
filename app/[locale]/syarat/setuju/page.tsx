import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { signOutAction } from "@/app/auth/actions";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { BrandLogo } from "@/components/brand-logo";
import { SubmitButton } from "@/components/forms/submit-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/require-user";
import { loadConsents } from "@/lib/data/consents";
import { withLocale } from "@/lib/i18n/paths";
import { hasAgreed } from "@/lib/legal/consent";
import { AgreeForm } from "./agree-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  return { title: t("agree.title"), robots: { index: false } };
}

/**
 * The agreement screen in front of every signed-in page (see lib/legal/gate.ts). It is never gated itself, and
 * always offers a way out: both documents, signing out, and deleting the account.
 */
export default async function AgreeTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { email } = await requireUser();
  const { next: rawNext } = await searchParams;
  const next = (Array.isArray(rawNext) ? rawNext[0] : rawNext) ?? "";
  if (hasAgreed(await loadConsents(), "terms")) {
    redirect(withLocale(safeNextPath(next) ?? DEFAULT_AFTER_LOGIN, (await getLocale()) as AppLocale));
  }

  const t = await getTranslations("Terms");
  const ta = await getTranslations("Account");
  const tAuth = await getTranslations("Auth");
  const terms = (chunks: React.ReactNode) => (
    <Link href="/syarat" className="font-medium text-foreground underline underline-offset-4">
      {chunks}
    </Link>
  );
  const privacy = (chunks: React.ReactNode) => (
    <Link href="/privasi" className="font-medium text-foreground underline underline-offset-4">
      {chunks}
    </Link>
  );

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <BrandLogo size="sm" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("agree.title")}</h1>
        <p className="text-sm text-muted-foreground">{t.rich("agree.body", { terms, privacy })}</p>
        <p className="text-sm text-muted-foreground">{t("agree.note")}</p>
      </div>
      <AgreeForm next={next} />
      <form action={signOutAction}>
        <SubmitButton variant="outline" className="w-full" pendingText={tAuth("signOutPending")}>
          {tAuth("signOut")}
        </SubmitButton>
      </form>
      <section className="space-y-4 rounded-lg border border-destructive/40 p-4 text-sm">
        <h2 className="font-medium text-destructive">{ta("deleteTitle")}</h2>
        <p className="text-muted-foreground">{ta("deleteDescription")}</p>
        {email ? <DeleteAccountForm email={email} /> : <p className="text-destructive">{ta("noEmail")}</p>}
      </section>
    </main>
  );
}
