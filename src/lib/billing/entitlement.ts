import "server-only";
import { adminClient } from "../supabase/server";
import { isActive } from "./revenuecat";
import { isListedEmail } from "./owner";

/** Kurucu hesap mı? (PREMIUM_EMAILS ortam değişkeni) */
export function isOwner(email: string | null | undefined): boolean {
  return isListedEmail(email, process.env.PREMIUM_EMAILS);
}

/** Kullanıcı Premium mu? Kurucu hesaplar, yönetici tarafından elle verilen Premium ve süren abonelik. */
export async function isPremium(userId: string, email?: string | null): Promise<boolean> {
  if (isOwner(email)) return true;
  const db = adminClient();
  const [sub, lim] = await Promise.all([
    db.from("subscriptions").select("status, period_end").eq("user_id", userId).maybeSingle(),
    // premium_override sütunu migration ile gelir; yoksa hata yok sayılır.
    db.from("user_limits").select("premium_override").eq("user_id", userId).maybeSingle(),
  ]);
  if (lim.data?.premium_override) return true;
  return isActive(sub.data);
}
