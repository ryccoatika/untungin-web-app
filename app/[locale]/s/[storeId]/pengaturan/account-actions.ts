"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { rawValues, type FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfirmationMatches } from "@/lib/validation/account";

/**
 * Deletes the signed-in user's account and everything it owns (profile → stores → all store data,
 * AI analyses and usage cascade). The session is verified first; the secret key is used only for
 * the auth admin call. The browser is then signed out.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = rawValues(formData, ["confirmEmail"]);
  const t = await getTranslations("Account");
  const { supabase, userId, email } = await requireUser();
  if (!email || !emailConfirmationMatches(values.confirmEmail ?? "", email)) {
    return { fieldErrors: { confirmEmail: [t("confirmMismatch")] }, values };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error(`Account deletion failed: ${error.message}`);
    return { message: t("deleteFailed"), values };
  }
  // The user no longer exists; clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  revalidatePath("/", "layout");
  return redirect({ href: "/?akun=dihapus", locale: await getLocale() });
}
