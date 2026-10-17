import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LineRef, StoreWarning, WarningCode } from "@/lib/calc";
import { cn } from "@/lib/utils";

const SERIOUS: WarningCode[] = ["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION"];

export function WarningsList({ warnings, lineLabel }: { warnings: StoreWarning[]; lineLabel: (ref: LineRef) => string }) {
  const t = useTranslations("Dashboard");
  const tWarnings = useTranslations("Warnings");
  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="warnings-title" className="space-y-2">
      <h2 id="warnings-title" className="text-lg font-semibold">
        {t("warningsTitle")}
      </h2>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.code}
            className={cn(
              "flex gap-3 rounded-lg border p-3 text-sm [overflow-wrap:anywhere]",
              SERIOUS.includes(warning.code)
                ? "border-destructive/40 bg-destructive/10"
                : "border-amber-500/40 bg-amber-500/10",
            )}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{tWarnings(warning.code, { products: warning.lines.map(lineLabel).join(", ") })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
