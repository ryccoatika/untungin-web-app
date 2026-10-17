"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { saveLocaleAction } from "@/lib/i18n/save-locale";
import { cn } from "@/lib/utils";

/** Switches the UI language and saves it to the profile (best-effort); shared by the switcher and the phone menu. */
export function useLocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: AppLocale) {
    if (next === locale) return;
    startTransition(async () => {
      try {
        await saveLocaleAction(next);
      } catch {
        /* saving is best-effort; the URL switch below still applies */
      }
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return { locale, pending, switchTo };
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LocaleSwitcher");
  const { locale, pending, switchTo } = useLocaleSwitch();

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
          aria-label={`${code.toUpperCase()} – ${t(code)}`}
          aria-pressed={code === locale}
          disabled={pending}
          onClick={() => switchTo(code)}
          className={cn(
            "h-10 min-w-10 rounded px-2 font-medium",
            code === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
