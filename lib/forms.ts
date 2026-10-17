export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Raw submitted strings, echoed on errors so forms can refill inputs. */
      values?: Record<string, string>;
    }
  | undefined;

/** Raw string values of the named fields, echoed back so a form can refill after an action. */
export function rawValues(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}
