import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MulaiPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;

  redirect(data.length === 0 ? "/onboarding" : `/s/${data[0].id}/dashboard`);
}
