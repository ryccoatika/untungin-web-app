"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreFields } from "@/components/store/store-fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { createStoreAction } from "./actions";

const IDENTITY_FIELDS = ["name", "businessType", "targetMarket"] as const;

function hasIdentityError(state: FormState) {
  return IDENTITY_FIELDS.some((field) => state?.fieldErrors?.[field]?.length);
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(createStoreAction, undefined);
  const [step, setStep] = useState<1 | 2>(1);
  const [seenState, setSeenState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);

  // When the server reports an error on step-1 fields, jump back to step 1.
  if (state !== seenState) {
    setSeenState(state);
    if (hasIdentityError(state)) setStep(1);
  }

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    const fields = ["name", "businessType"].map(
      (name) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement,
    );
    if (fields.every((field) => field.reportValidity())) setStep(2);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <p className="text-sm text-muted-foreground">Langkah {step} dari 2</p>

      <div hidden={step !== 1} className="space-y-6">
        <StoreFields section="identity" errors={state?.fieldErrors} />
        <Button type="button" className="w-full" onClick={goNext}>
          Lanjut
        </Button>
      </div>

      <div hidden={step !== 2} className="space-y-6">
        <StoreFields section="operations" errors={state?.fieldErrors} />
        {state?.message && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Kembali
          </Button>
          <SubmitButton className="flex-1" pendingText="Membuat toko…">
            Buat toko
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
