"use client";

import { Download, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";

/** Print / save as PDF (the browser's print dialog) and the CSV download. Hidden on paper. */
export function ReportToolbar({ csvHref }: { csvHref: string }) {
  const t = useTranslations("Report");
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
