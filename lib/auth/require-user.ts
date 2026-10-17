import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return redirect({ href: "/login", locale: await getLocale() });
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId: data.claims.sub, email };
}
