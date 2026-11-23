import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function serverConfigured(): boolean {
  return !!(URL() && ANON() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let admin: SupabaseClient | null = null;

/** service_role istemcisi: RLS'yi aşar, YALNIZCA sunucuda kullanılır. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(URL(), process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Kullanıcının kendi belirteciyle çalışan istemci: tüm sorgulara RLS uygulanır. */
export function userClient(token: string): SupabaseClient {
  return createClient(URL(), ANON(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export interface AuthContext {
  user: User;
  token: string;
}

/** `Authorization: Bearer <jwt>` başlığını Supabase Auth ile doğrular. */
export async function authenticate(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !serverConfigured()) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}

export async function isAdmin(user: User): Promise<boolean> {
  const emails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // E-posta ile yönetici ataması yalnızca doğrulanmış e-postalar için geçerlidir.
  if (user.email && user.email_confirmed_at && emails.includes(user.email.toLowerCase())) return true;
  const { data } = await adminClient().from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return !!data;
}

export async function logError(source: string, message: string, detail?: unknown, userId?: string | null) {
  try {
    await adminClient()
      .from("error_logs")
      .insert({ source, message: message.slice(0, 1000), detail: detail ?? null, user_id: userId ?? null });
  } catch {
    console.error(`[${source}] ${message}`);
  }
}

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
