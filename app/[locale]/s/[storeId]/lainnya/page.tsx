import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getStore } from "@/lib/data/stores";
import { moreNavItems } from "@/lib/nav";

export default async function MorePage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const t = await getTranslations("StoreShell");

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.more")}</h1>
      <ul className="space-y-2">
        {moreNavItems(store.id).map((entry) => (
          <li key={entry.href}>
            <Link href={entry.href} className="flex min-h-14 items-center gap-3 rounded-lg border p-4 hover:bg-accent/60">
              <entry.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{t(`nav.${entry.labelKey}`)}</span>
                <span className="block text-sm text-muted-foreground">{t(`moreDescriptions.${entry.labelKey}`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
