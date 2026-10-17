import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { simulationHref, type AnalysisOutput, type Priority } from "@/lib/ai/output";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<Priority, string> = {
  tinggi: "bg-destructive/10 text-destructive",
  sedang: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  rendah: "bg-muted text-muted-foreground",
};

/** One analysis (spec §6.2). `output` is already sanitised against today's data. */
export async function AnalysisView({
  output,
  storeId,
  productName,
}: {
  output: AnalysisOutput;
  storeId: string;
  productName: (id: string) => string;
}) {
  const t = await getTranslations("Analysis");
  return (
    <div className="space-y-5 text-sm [overflow-wrap:anywhere]">
      <section className="space-y-1">
        <h3 className="font-medium">{t("summary")}</h3>
        <p>{output.summary}</p>
      </section>

      {output.highlights.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-medium">{t("highlights")}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {output.highlights.map((highlight, i) => (
              <li key={i}>{highlight}</li>
            ))}
          </ul>
        </section>
      )}

      {output.issues.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">{t("issues")}</h3>
          <ul className="space-y-3">
            {output.issues.map((issue, i) => (
              <li key={i} className="space-y-1 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-medium", PRIORITY_STYLE[issue.priority])}>
                    {t(`priority.${issue.priority}`)}
                  </span>
                  <span className="font-medium">{issue.title}</span>
                </div>
                <p>{issue.explanation}</p>
                {issue.related_product_ids.length > 0 && (
                  <p className="text-muted-foreground">
                    {t("relatedProducts")}: {issue.related_product_ids.map(productName).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {output.recommendations.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium">{t("recommendations")}</h3>
          <ul className="space-y-3">
            {output.recommendations.map((recommendation, i) => (
              <li key={i} className="space-y-2 rounded-lg border p-3">
                <p className="font-medium">{recommendation.action}</p>
                <p>{recommendation.reason}</p>
                {recommendation.simulation && (
                  <Link
                    href={simulationHref(storeId, recommendation.simulation)}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "h-10" })}
                  >
                    {t("trySimulation")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
