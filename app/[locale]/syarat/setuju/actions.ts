"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/require-user";
import { recordConsent } from "@/lib/data/consents";
import type { FormState } from "@/lib/forms";
import { withLocale } from "@/lib/i18n/paths";

/**
 * Records agreement to the current terms, then continues to `next` (unsafe values fall back to the default page).
 * Used with useActionState: on failure it returns the message shown under the button and stays on the page.
 */
export async function acceptTermsAction(next: string): Promise<FormState> {
  const { supabase, userId } = await requireUser();
  try {
    await recordConsent(supabase, userId, "terms");
  } catch (error) {
    console.error(`Recording terms consent failed: ${error instanceof Error ? error.message : String(error)}`);
    const t = await getTranslations("Terms");
    return { message: t("agree.failed") };
  }
  const locale = (await getLocale()) as AppLocale;
  return redirect(withLocale(safeNextPath(next) ?? DEFAULT_AFTER_LOGIN, locale));
}
