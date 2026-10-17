"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const THEME_MODES = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
] as const;
type Mode = (typeof THEME_MODES)[number]["value"];

function isMode(value: string | undefined): value is Mode {
  return THEME_MODES.some((mode) => mode.value === value);
}

const noopSubscribe = () => () => {};

/** The chosen theme mode and its setter; shared by the header toggle and the phone menu. */
export function useThemeMode() {
  const { theme, setTheme } = useTheme();
  // The stored choice is only known in the browser; render the default until hydrated.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const current: Mode = hydrated && isMode(theme) ? theme : "system";
  const { Icon } = THEME_MODES.find((mode) => mode.value === current)!;
  return { current, Icon, setTheme: (value: string) => setTheme(value) };
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("Theme");
  const { current, Icon, setTheme } = useThemeMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("trigger", { mode: t(current) })}
        className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0", className)}
      >
        <Icon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => setTheme(String(value))}>
          {THEME_MODES.map(({ value, Icon: ItemIcon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-10">
              <ItemIcon aria-hidden />
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
