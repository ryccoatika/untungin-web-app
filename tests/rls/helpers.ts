import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    "Supabase env missing. Run `npm run db:start && npm run env:local` first.",
  );
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(url, secretKey, noSession);
export const anonClient = () => createClient(url, publishableKey, noSession);

export type TestUser = { id: string; client: SupabaseClient };

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@test.local`;
  const password = "password-123456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error) throw error;

  const client = createClient(url!, publishableKey!, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

export async function createStore(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.client.rpc("create_store", {
    p_name: name,
    p_business_type: "minuman",
    p_operating_days: 26,
    p_target_margin: 40,
  });
  if (error) throw error;
  return data as string;
}
