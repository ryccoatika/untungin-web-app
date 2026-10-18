import { getTranslations } from "next-intl/server";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth/require-user";
import { listStores } from "@/lib/data/stores";
import { requireCurrentTerms } from "@/lib/legal/gate";
import { DemoStoreButton } from "./demo-store-button";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { email } = await requireUser();
  await requireCurrentTerms("/onboarding");
  const ta = await getTranslations("Account");
  const t = await getTranslations("Onboarding");
  const stores = await listStores();
  const isFirstStore = stores.length === 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="flex justify-end gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {isFirstStore ? t("titleFirst") : t("titleAnother")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>
      <OnboardingForm />
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <DemoStoreButton />
      {!isFirstStore && (
        <Link href="/toko" className={buttonVariants({ variant: "ghost", className: "w-full text-muted-foreground" })}>
          {t("cancel")}
        </Link>
      )}
      {isFirstStore && (
        <details className="rounded-lg border border-destructive/40 p-4 text-sm">
          <summary className="flex min-h-10 cursor-pointer items-center font-medium text-destructive">{ta("deleteTitle")}</summary>
          <div className="mt-4 space-y-4">
            <p className="text-muted-foreground">{ta("deleteDescription")}</p>
            {email ? <DeleteAccountForm email={email} /> : <p className="text-destructive">{ta("noEmail")}</p>}
          </div>
        </details>
      )}
    </main>
  );
}
