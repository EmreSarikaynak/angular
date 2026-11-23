import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && anon);

let client: SupabaseClient | null = null;

/** Tarayıcı istemcisi: yalnızca herkese açık (anon) anahtarı kullanır; veri erişimini RLS sınırlar. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(url ?? "http://localhost", anon ?? "missing", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
