import { Circle, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ChecklistItem } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const t = useTranslations("Checklist");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("intro")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-accent/60">
                {item.done ? (
                  <CircleCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cn("min-w-0", item.done && "text-muted-foreground line-through")}>
                  {t(`items.${item.key}`)}
                </span>
                <span className="sr-only">{item.done ? t("done") : t("todo")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
