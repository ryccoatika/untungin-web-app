import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LineRef, StoreWarning, WarningCode } from "@/lib/calc";
import { cn } from "@/lib/utils";

const LISTED: WarningCode[] = ["LOSS_PRODUCTS", "BELOW_TARGET", "COMPETITOR_GAP"];
const MAX_LINES = 3;
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
            <div className="min-w-0 space-y-1">
              {warning.lines.length > 0 && LISTED.includes(warning.code) ? (
                <>
                  <p>{tWarnings(`${warning.code}_intro` as "BELOW_TARGET_intro")}</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {warning.lines.slice(0, MAX_LINES).map((ref) => (
                      <li key={`${ref.productId}:${ref.channelId}`}>{lineLabel(ref)}</li>
                    ))}
                  </ul>
                  {warning.lines.length > MAX_LINES && (
                    <p className="font-medium">{tWarnings("moreLines", { count: warning.lines.length - MAX_LINES })}</p>
                  )}
                </>
              ) : (
                <p>{tWarnings(warning.code, { products: warning.lines.map(lineLabel).join(", ") })}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
