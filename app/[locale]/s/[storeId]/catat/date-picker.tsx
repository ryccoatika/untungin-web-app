"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { confirmLeave } from "./leave-guard";

/** Native date input limited to the days that can be recorded; picking a day opens Catat for it. */
export function DatePicker({ storeId, date, min, max }: { storeId: string; date: string; min: string; max: string }) {
  const t = useTranslations("Records.sales");
  const router = useRouter();
  return (
    <Input
      type="date"
      aria-label={t("date")}
      className="h-11 w-auto min-w-40"
      value={date}
      min={min}
      max={max}
      onChange={(event) => {
        const value = event.target.value;
        // An empty value (cleared field) or one outside the range is ignored; the server checks again.
        // The input stays controlled by `date`, so a declined leave puts the old day back.
        if (value && value >= min && value <= max && confirmLeave()) router.push(`/s/${storeId}/catat?tanggal=${value}`);
      }}
    />
  );
}
