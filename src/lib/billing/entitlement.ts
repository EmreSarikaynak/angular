import "server-only";
import { adminClient } from "../supabase/server";
import { isActive } from "./revenuecat";

/** Kullanıcının premium aboneliği sürüyor mu? */
export async function isPremium(userId: string): Promise<boolean> {
  const { data } = await adminClient().from("subscriptions").select("status, period_end").eq("user_id", userId).maybeSingle();
  return isActive(data);
}
