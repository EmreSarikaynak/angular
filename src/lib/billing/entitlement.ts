import "server-only";
import { adminClient } from "../supabase/server";
import { isActive } from "./revenuecat";
import { isListedEmail } from "./owner";

/** Kurucu hesap mı? (PREMIUM_EMAILS ortam değişkeni) */
export function isOwner(email: string | null | undefined): boolean {
  return isListedEmail(email, process.env.PREMIUM_EMAILS);
}

/** Kullanıcı Premium mu? Kurucu hesaplar her zaman; diğerleri aboneliği sürüyorsa. */
export async function isPremium(userId: string, email?: string | null): Promise<boolean> {
  if (isOwner(email)) return true;
  const { data } = await adminClient().from("subscriptions").select("status, period_end").eq("user_id", userId).maybeSingle();
  return isActive(data);
}
