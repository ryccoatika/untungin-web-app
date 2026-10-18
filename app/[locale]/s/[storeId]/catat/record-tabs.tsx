import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Penjualan / Belanja: two pages of Catat, shown as tabs. */
export async function RecordTabs({ storeId, active }: { storeId: string; active: "sales" | "purchases" }) {
  const t = await getTranslations("Records");
  const tabs = [
    { key: "sales", href: `/s/${storeId}/catat`, label: t("tabSales") },
    { key: "purchases", href: `/s/${storeId}/catat/belanja`, label: t("tabPurchases") },
  ] as const;
  return (
    <nav aria-label={t("tabsLabel")} className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex min-h-10 flex-1 items-center justify-center rounded-md px-3 text-sm",
            tab.key === active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
