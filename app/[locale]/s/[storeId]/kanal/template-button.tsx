"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormAction } from "@/lib/forms";

/** One-click "add this template" form; success re-renders the page without the button. */
export function TemplateButton({ action, label }: { action: FormAction; label: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-1">
      <SubmitButton variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" pendingText={label}>
        {label}
      </SubmitButton>
      {state && !state.ok && <FormMessage state={state} />}
    </form>
  );
}
