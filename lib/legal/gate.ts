import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { withLocale } from "@/lib/i18n/paths";
import { hasAgreed } from "@/lib/legal/consent";
import { loadConsents } from "@/lib/data/consents";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends a signed-in user who hasn't agreed to the current terms to the agreement screen, which returns them
 * to `next` (a same-origin path, without or with a locale) afterwards. Signed-out visitors pass: the proxy and
 * `requireUser` send them to login. Call it only from signed-in pages, never from public ones.
 */
export async function requireCurrentTerms(next: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return;
  if (hasAgreed(await loadConsents(), "terms")) return;

  const locale = (await getLocale()) as AppLocale;
  redirect({ href: `/syarat/setuju?next=${encodeURIComponent(withLocale(next, locale))}`, locale });
}
