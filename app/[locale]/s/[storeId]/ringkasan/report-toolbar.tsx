"use client";

import { Download, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import { getPathname, usePathname } from "@/i18n/navigation";

/** Print / save as PDF (the browser's print dialog) and the CSV download. Hidden on paper. */
export function ReportToolbar({ query }: { query: string }) {
  const t = useTranslations("Report");
  const pathname = usePathname(); // without the locale prefix
  const locale = useLocale() as AppLocale;
  const csvHref = getPathname({ href: `${pathname}/csv${query ? `?${query}` : ""}`, locale });
  return (
    <div role="group" aria-label={t("toolbarLabel")} className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" onClick={() => window.print()}>
        <Printer aria-hidden />
        {t("print")}
      </Button>
      {/* A plain anchor: the response is a file, so no client-side navigation. */}
      <a href={csvHref} className={buttonVariants({ variant: "outline" })}>
        <Download aria-hidden />
        {t("downloadCsv")}
      </a>
    </div>
  );
}
