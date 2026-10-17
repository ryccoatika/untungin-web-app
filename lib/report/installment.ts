import { z } from "zod";
import { localeNumber, parseWholeNumber } from "@/lib/validation/number";

export const DEFAULT_KUR_RATE_PCT = 6;
export const MAX_TENOR_MONTHS = 60;
export const MAX_RATE_PCT = 30;
export const MAX_PRINCIPAL = 2_000_000_000;
/** Longest owner name the summary accepts (the form and the Server Action share it). */
export const MAX_OWNER_NAME_LENGTH = 80;

export type InstallmentInput = { principal: number; months: number; annualRatePct: number };

/** Annuity instalment in whole Rupiah: P·r / (1 − (1 + r)^−n) with r = annual rate / 12; r = 0 gives P / n. */
export function monthlyInstallment(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  const raw = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(raw);
}

export type Query = Record<string, string | string[] | undefined>;

/** First value of a query key, trimmed; "" when absent. */
export function firstParam(query: Query, key: string): string {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const rateSchema = localeNumber(z.number().finite());

/**
 * Reads ?pinjaman=&tenor=&bunga= from the URL. No parameters gives `{ input: null, errors: [] }`;
 * a blank rate defaults to the KUR rate when principal and tenor are valid.
 */
export function parseInstallmentParams(query: Query): { input: InstallmentInput | null; errors: ("principal" | "months" | "rate")[] } {
  const rawPrincipal = firstParam(query, "pinjaman");
  const rawMonths = firstParam(query, "tenor");
  const rawRate = firstParam(query, "bunga");
  if (rawPrincipal === "" && rawMonths === "" && rawRate === "") return { input: null, errors: [] };

  const errors: ("principal" | "months" | "rate")[] = [];

  const principal = parseWholeNumber(rawPrincipal);
  if (principal === undefined || !Number.isFinite(principal) || principal <= 0 || principal > MAX_PRINCIPAL) errors.push("principal");

  const months = parseWholeNumber(rawMonths);
  if (months === undefined || !Number.isFinite(months) || months < 1 || months > MAX_TENOR_MONTHS) errors.push("months");

  let rate = DEFAULT_KUR_RATE_PCT;
  if (rawRate !== "") {
    const parsed = rateSchema.safeParse(rawRate);
    if (!parsed.success || parsed.data < 0 || parsed.data > MAX_RATE_PCT) errors.push("rate");
    else rate = parsed.data;
  }

  if (errors.length > 0) return { input: null, errors };
  return { input: { principal: principal as number, months: months as number, annualRatePct: rate }, errors };
}
