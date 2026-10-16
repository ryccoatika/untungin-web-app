export type Translate = (key: string) => string;

/** Maps zod field errors (message keys) to translated messages. */
export function translateFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  t: Translate,
): Record<string, string[] | undefined> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.map((message) => t(message))]),
  );
}
