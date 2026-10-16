"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { saveLocaleAction } from "@/lib/i18n/save-locale";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await saveLocaleAction(next);
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex shrink-0 rounded-md border p-0.5 text-sm", className)}
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-label={t(code)}
          aria-pressed={code === locale}
          disabled={pending}
          onClick={() => switchTo(code)}
          className={cn(
            "h-9 min-w-10 rounded px-2 font-medium",
            code === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
