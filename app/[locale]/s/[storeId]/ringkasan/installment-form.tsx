"use client";

import { useTranslations } from "next-intl";
import { useId, useTransition, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";

type Field = "principal" | "months" | "rate";

/** Loan amount, term and rate. "Hitung" writes them to the URL; the server page re-renders the result. */
export function InstallmentForm({
  initial,
  errors,
}: {
  initial: { pinjaman: string; tenor: string; bunga: string };
  errors: Field[];
}) {
  const t = useTranslations("Report");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const has = (field: Field) => errors.includes(field);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["pinjaman", "tenor", "bunga"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value !== "") params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <Card className="print:hidden">
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("installmentTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("installmentIntro")}</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-pinjaman`}>{t("principal")}</Label>
            <MoneyInput
              id={`${id}-pinjaman`}
              name="pinjaman"
              placeholder="10.000.000"
              defaultValue={initial.pinjaman}
              aria-invalid={has("principal") || undefined}
            />
            {has("principal") && <FieldError errors={[t("principalError")]} />}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-tenor`}>{t("months")}</Label>
            <Input
              id={`${id}-tenor`}
              name="tenor"
              inputMode="numeric"
              autoComplete="off"
              placeholder="12"
              defaultValue={initial.tenor}
              aria-invalid={has("months") || undefined}
            />
            {has("months") && <FieldError errors={[t("monthsError")]} />}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-bunga`}>{t("rate")}</Label>
            <Input
              id={`${id}-bunga`}
              name="bunga"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={initial.bunga}
              aria-invalid={has("rate") || undefined}
              aria-describedby={`${id}-rate-hint`}
            />
            {has("rate") && <FieldError errors={[t("rateError")]} />}
          </div>
          <p id={`${id}-rate-hint`} className="text-xs text-muted-foreground sm:col-span-3">
            {t("rateHint")}
          </p>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {t("calculate")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
