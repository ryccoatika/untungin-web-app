"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { devLoginAction } from "./actions";

export function DevLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(devLoginAction, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-xs font-medium text-muted-foreground">Mode pengembangan</p>
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <Label htmlFor="dev-email">Email</Label>
        <Input id="dev-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dev-password">Password</Label>
        <Input id="dev-password" name="password" type="password" minLength={6} required />
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <SubmitButton variant="secondary" className="w-full" pendingText="Masuk…">
        Masuk (dev)
      </SubmitButton>
    </form>
  );
}
