import "server-only";
import { getTranslations } from "next-intl/server";
import type { Translate } from "./translate";

/** Translator for keys under `Validation`; unknown keys are returned unchanged. */
export async function getValidationTranslator(): Promise<Translate> {
  const t = await getTranslations("Validation");
  // Keys come from zod at runtime, so they are not statically typed.
  return (key) => (t.has(key as never) ? t(key as never) : key);
}

/** Label for a stored business_type value; unknown values are shown as-is. */
export async function getBusinessTypeLabel(): Promise<(value: string) => string> {
  const t = await getTranslations("BusinessType");
  return (value) => (t.has(value as never) ? t(value as never) : value);
}
