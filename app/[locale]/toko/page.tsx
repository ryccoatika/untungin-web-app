import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { listStores } from "@/lib/data/stores";
import { getBusinessTypeLabel } from "@/lib/i18n/server";

export default async function StoresPage() {
  const stores = await listStores();
  const t = await getTranslations("StoreList");
  const tAuth = await getTranslations("Auth");
  const businessTypeLabel = await getBusinessTypeLabel();
  if (stores.length === 0) return redirect({ href: "/onboarding", locale: await getLocale() });

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <form action={signOutAction}>
          <SubmitButton variant="ghost" size="sm" pendingText={tAuth("signOutPending")}>
            {tAuth("signOut")}
          </SubmitButton>
        </form>
      </div>
      <ul className="space-y-2">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              href={`/s/${store.id}/dashboard`}
              className="block rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <p className="truncate font-medium">{store.name}</p>
              <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/onboarding" className={buttonVariants({ className: "w-full" })}>
        {t("add")}
      </Link>
    </main>
  );
}
