"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { acceptAiTermsAction, analyzeStoreAction, type AnalyzeState } from "./actions";

/**
 * The analyze button. Until the user has agreed to the current AI terms (`aiAgreed`, or the server answering
 * `needsConsent`), it opens the consent dialog instead of submitting; agreeing records the consent and then submits
 * in the same tap. The server checks the consent again, so this dialog is a courtesy, not the guard.
 */
export function AnalyzeForm({ storeId, disabled, aiAgreed }: { storeId: string; disabled: boolean; aiAgreed: boolean }) {
  const t = useTranslations("Analysis");
  const formRef = useRef<HTMLFormElement>(null);
  const [agreed, setAgreed] = useState(aiAgreed);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction] = useActionState<AnalyzeState, FormData>(async (prev, formData) => {
    const next = await analyzeStoreAction(storeId, prev, formData);
    if (next?.status === "needsConsent") {
      setAgreed(false);
      setDialogOpen(true);
    }
    return next;
  }, undefined);
  const ok = state?.status === "created" || state?.status === "cached";

  return (
    <>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <SubmitButton
          pendingText={t("analyzing")}
          disabled={disabled}
          className="w-full sm:w-auto"
          type={agreed ? "submit" : "button"}
          onClick={agreed ? undefined : () => setDialogOpen(true)}
        >
          {t("analyze")}
        </SubmitButton>
        {/* Both regions stay mounted so screen readers announce the text when it appears; while empty they are
            visually hidden (sr-only is out of the flex flow, so no gap is left). */}
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:sr-only">
          {ok ? state.message : ""}
        </p>
        <p role="alert" className="text-sm text-destructive empty:sr-only">
          {state && !ok ? state.message : ""}
        </p>
      </form>
      {/* Outside the form: the dialog's buttons must never submit it. */}
      <AiConsentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAgreed={() => {
          setAgreed(true);
          setDialogOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}

function AiConsentDialog({
  open,
  onOpenChange,
  onAgreed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgreed: () => void;
}) {
  const t = useTranslations("Analysis.consent");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const items = t.raw("items") as string[];

  const agree = () =>
    startTransition(async () => {
      setError(null);
      let result: Awaited<ReturnType<typeof acceptAiTermsAction>>;
      try {
        result = await acceptAiTermsAction();
      } catch {
        result = { ok: false };
      }
      if (result.ok) onAgreed();
      else setError(result.message ?? t("failed"));
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the consent is saving, a close would still be followed by the analysis, so ignore it.
        if (pending && !next) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 [overflow-wrap:anywhere]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-4">
          <Link href="/syarat#ai" className="inline-flex min-h-10 items-center font-medium underline underline-offset-4">
            {t("termsLink")}
          </Link>
          <Link href="/privasi" className="inline-flex min-h-10 items-center font-medium underline underline-offset-4">
            {t("privacyLink")}
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>{t("cancel")}</DialogClose>
          <Button onClick={agree} disabled={pending} aria-disabled={pending}>
            {pending ? t("agreeing") : t("agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
