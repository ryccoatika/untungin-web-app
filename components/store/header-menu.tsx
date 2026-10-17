"use client";

import { Ellipsis, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { signOutAction } from "@/app/auth/actions";
import { useLocaleSwitch } from "@/components/locale-switcher";
import { THEME_MODES, useThemeMode } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing, type AppLocale } from "@/i18n/routing";

/** Phone header: theme, language and sign-out collapsed into one menu (from md they show inline). */
export function HeaderMenu() {
  const t = useTranslations("StoreShell");
  const tTheme = useTranslations("Theme");
  const tLocale = useTranslations("LocaleSwitcher");
  const tAuth = useTranslations("Auth");
  const { current, setTheme } = useThemeMode();
  const { locale, pending: localePending, switchTo } = useLocaleSwitch();
  const [signingOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("moreActions")}
        className={buttonVariants({ variant: "outline", size: "icon", className: "md:hidden" })}
      >
        <Ellipsis className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tTheme("label")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={current} onValueChange={(value) => setTheme(String(value))}>
            {THEME_MODES.map(({ value, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} className="min-h-10">
                <Icon aria-hidden />
                {tTheme(value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tLocale("label")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={locale} onValueChange={(value) => switchTo(value as AppLocale)}>
            {routing.locales.map((code) => (
              <DropdownMenuRadioItem key={code} value={code} lang={code} disabled={localePending} className="min-h-10">
                {tLocale(code)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-10"
          disabled={signingOut}
          closeOnClick={false}
          onClick={() => startSignOut(async () => { await signOutAction(); })}
        >
          <LogOut aria-hidden />
          {signingOut ? tAuth("signOutPending") : tAuth("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
