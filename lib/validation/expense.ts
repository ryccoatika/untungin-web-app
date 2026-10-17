import { z } from "zod";
import { EXPENSE_CATEGORIES, FREQUENCIES } from "@/lib/calc/types";
import { MAX_AMOUNT, requiredName } from "./common";
import { wholeNumber } from "./number";

export const EXPENSE_VALIDATION_KEYS = [
  "expense.nameRequired",
  "expense.nameTooLong",
  "expense.categoryInvalid",
  "expense.amountNumber",
  "expense.amountMin",
  "expense.frequencyInvalid",
] as const;

export const expenseInputSchema = z.object({
  name: requiredName("expense", 80),
  category: z.enum(EXPENSE_CATEGORIES, { error: "expense.categoryInvalid" }),
  amount: wholeNumber(
    z.number({ error: "expense.amountNumber" }).int("expense.amountNumber").min(0, "expense.amountMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  frequency: z.enum(FREQUENCIES, { error: "expense.frequencyInvalid" }),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export function toExpenseColumns(input: ExpenseInput) {
  return { name: input.name, category: input.category, amount: input.amount, frequency: input.frequency };
}
