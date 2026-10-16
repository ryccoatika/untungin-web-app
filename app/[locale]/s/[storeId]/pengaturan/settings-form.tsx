"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreFields, type StoreFieldDefaults } from "@/components/store/store-fields";
import { updateStoreAction } from "./actions";

export function SettingsForm({ storeId, defaults }: { storeId: string; defaults: StoreFieldDefaults }) {
  const [state, formAction] = useActionState(updateStoreAction.bind(null, storeId), undefined);
  const [seenState, setSeenState] = useState(state);
  const [fieldsKey, setFieldsKey] = useState(0);

  if (state !== seenState) {
    setSeenState(state);
    // Remount so refilled defaults apply (React's post-action reset drops a changed <select> default).
    setFieldsKey((k) => k + 1);
  }

  // React resets uncontrolled fields after an action; refill from the echoed values
  // (typed values on error, saved values on success).
  const values = state?.values;
  const current: StoreFieldDefaults = values
    ? {
        name: values.name,
        businessType: values.businessType,
        targetMarket: values.targetMarket,
        operatingDaysPerMonth: values.operatingDaysPerMonth,
        targetMarginPct: values.targetMarginPct,
      }
    : defaults;

  return (
    <form action={formAction} className="space-y-6">
      <StoreFields key={`identity-${fieldsKey}`} section="identity" defaults={current} errors={state?.fieldErrors} />
      <StoreFields key={`operations-${fieldsKey}`} section="operations" defaults={current} errors={state?.fieldErrors} />
      {state?.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      )}
      <SubmitButton className="w-full sm:w-auto" pendingText="Menyimpan…">
        Simpan perubahan
      </SubmitButton>
    </form>
  );
}
