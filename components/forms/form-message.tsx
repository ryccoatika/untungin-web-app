import type { FormState } from "@/lib/forms";

/** The action's overall message: a polite status on success, an alert on failure. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}
