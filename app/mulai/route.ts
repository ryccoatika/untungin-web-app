import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;

  const target = data.length === 0 ? "/onboarding" : `/s/${data[0].id}/dashboard`;
  return NextResponse.redirect(new URL(target, request.url));
}
