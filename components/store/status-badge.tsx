import { useTranslations } from "next-intl";
import type { LineStatus } from "@/lib/calc";
import { cn } from "@/lib/utils";

const STYLES: Record<LineStatus, string> = {
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  yellow: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  green: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
};

/** A line's status as colour and text, never colour alone. */
export function StatusBadge({ status }: { status: LineStatus }) {
  const t = useTranslations("LineStatus");
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", STYLES[status])}>
      {t(status)}
    </span>
  );
}
