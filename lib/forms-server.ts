import "server-only";
import { z } from "zod";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { rawValues, type FormState } from "./forms";

export type ParsedForm<T> =
  | { values: Record<string, string>; input: T; error: undefined }
  | { values: Record<string, string>; input: undefined; error: NonNullable<FormState> };

/** Reads the named fields and validates them; on failure returns translated field errors with the raw values echoed. */
export async function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  fields: readonly string[],
): Promise<ParsedForm<z.output<S>>> {
  const values = rawValues(formData, fields);
  const parsed = schema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const t = await getValidationTranslator();
  const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
  return { values, input: undefined, error: { fieldErrors: translateFieldErrors(fieldErrors, t), values } };
}
