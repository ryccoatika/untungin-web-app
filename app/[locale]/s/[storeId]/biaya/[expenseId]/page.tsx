import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteExpenseAction, updateExpenseAction } from "../actions";
import { ExpenseForm } from "../expense-form";

type Params = Promise<{ locale: string; storeId: string; expenseId: string }>;

export default async function EditExpensePage({ params }: { params: Params }) {
  const { storeId, expenseId } = await params;
  const data = await loadStoreData(storeId);
  const expense = data?.expenses.find((e) => e.id === expenseId);
  if (!data || !expense) notFound();
  const t = await getTranslations("Expenses");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/biaya`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <ExpenseForm
            action={updateExpenseAction.bind(null, data.store.id, expense.id)}
            defaults={{
              name: expense.name,
              category: expense.category,
              amount: String(expense.amount),
              frequency: expense.frequency,
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteExpenseAction.bind(null, data.store.id, expense.id)} label={t("delete")} />
    </div>
  );
}
