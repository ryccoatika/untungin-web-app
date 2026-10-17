"use client";

import type { ComponentProps, FocusEvent } from "react";
import { useLocale } from "next-intl";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { groupDigits } from "@/lib/format";

/** Rupiah field: shows "18.000" after leaving the field; accepts everything the server's wholeNumber accepts. */
export function MoneyInput({ defaultValue, onBlur, ...props }: ComponentProps<typeof Input>) {
  const locale = useLocale() as AppLocale;
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.value = groupDigits(event.currentTarget.value, locale);
    onBlur?.(event);
  };
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      {...props}
      defaultValue={defaultValue === undefined ? undefined : groupDigits(defaultValue as string | number, locale)}
      onBlur={handleBlur}
    />
  );
}
