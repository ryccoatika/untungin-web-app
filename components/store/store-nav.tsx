"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { bottomNavItems, isMoreActive, isNavActive, storeNavItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function StoreNav({ storeId, variant }: { storeId: string; variant: "sidebar" | "bottom" }) {
  const t = useTranslations("StoreShell");
  const pathname = usePathname();
  if (variant === "bottom") {
    const items = bottomNavItems(storeId);
    return (
      <nav
        aria-label={t("menu")}
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        {items.map((item) => {
          const active = item.labelKey === "more" ? isMoreActive(pathname, storeId) : isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {t(`nav.${item.labelKey}`)}
            </Link>
          );
        })}
      </nav>
    );
  }

  const items = storeNavItems(storeId);
  return (
    <nav aria-label={t("menu")} className="flex flex-col gap-1 print:hidden">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {t(`nav.${item.labelKey}`)}
          </Link>
        );
      })}
    </nav>
  );
}
