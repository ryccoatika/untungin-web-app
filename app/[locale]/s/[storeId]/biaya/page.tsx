import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { monthlyAmount, monthlyExpenses } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatRupiah } from "@/lib/format";
import { createExpenseAction } from "./actions";
import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Expenses");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("ExpenseCategory");
  const tFrequency = await getTranslations("Frequency");
  const locale = await getLocale();
  const days = data.store.operatingDaysPerMonth;
  const hasOwnerSalary = data.expenses.some((expense) => expense.category === "gaji_pemilik");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {!hasOwnerSalary && (
        <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {t("ownerSalaryHint")}
        </p>
      )}

      {data.expenses.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-expense" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y rounded-lg border">
            {data.expenses.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/s/${data.store.id}/biaya/${expense.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{expense.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {tCategory(expense.category)} ·{" "}
                      {t("amountPerFrequency", {
                        amount: formatRupiah(expense.amount, locale),
                        frequency: tFrequency(expense.frequency),
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium">
                    {t("monthlyValue", { amount: formatRupiah(monthlyAmount(expense, days), locale) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex justify-between gap-3 px-1 font-medium">
            <span>{t("monthlyTotal")}</span>
            <span data-testid="expenses-total">{formatRupiah(monthlyExpenses(data.expenses, days), locale)}</span>
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            id="add-expense"
            action={createExpenseAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
