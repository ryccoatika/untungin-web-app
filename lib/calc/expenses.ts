import type { CalcExpense } from "./types";

/** Normalizes a cost to one month: daily × open days, weekly × 52/12, yearly / 12. */
export function monthlyAmount(expense: Pick<CalcExpense, "amount" | "frequency">, operatingDaysPerMonth: number): number {
  switch (expense.frequency) {
    case "harian":
      return expense.amount * operatingDaysPerMonth;
    case "mingguan":
      return (expense.amount * 52) / 12;
    case "bulanan":
      return expense.amount;
    case "tahunan":
      return expense.amount / 12;
  }
}

export function monthlyExpenses(expenses: CalcExpense[], operatingDaysPerMonth: number): number {
  return expenses.reduce((sum, expense) => sum + monthlyAmount(expense, operatingDaysPerMonth), 0);
}
