import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { requireUser } from "@/lib/auth/require-user";
import { listStores } from "@/lib/data/stores";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  const t = await getTranslations("Onboarding");
  const stores = await listStores();
  const isFirstStore = stores.length === 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="flex justify-end">
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
      {!isFirstStore && (
        <Link href="/toko" className="block text-center text-sm text-muted-foreground underline">
          {t("cancel")}
        </Link>
      )}
    </main>
  );
}
