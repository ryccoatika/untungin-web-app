import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireCurrentTerms } from "@/lib/legal/gate";
import { createClient } from "@/lib/supabase/server";

export default async function MulaiPage() {
  await requireCurrentTerms("/mulai");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;

  return redirect({
    href: data.length === 0 ? "/onboarding" : `/s/${data[0].id}/dashboard`,
    locale: await getLocale(),
  });
}
