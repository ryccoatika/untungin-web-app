"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  // Only end this device's session; a failure still clears the local cookie, so redirect anyway.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
