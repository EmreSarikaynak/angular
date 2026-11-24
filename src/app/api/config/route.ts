import { adminClient, authenticate, isAdmin, json, serverConfigured } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { geminiConfigured } from "@/lib/ai/gemini";
import { fcmConfigured } from "@/lib/bkn/fcm";
import { isPremium } from "@/lib/billing/entitlement";

/** Oturum açmış kullanıcı için çalışma zamanı bilgileri: YZ durumu, kalan kota, duyuru. */
export async function GET(req: Request) {
  if (!serverConfigured()) return json({ error: "server_not_configured" }, 503);
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const settings = await getSettings();
  const db = adminClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [{ data: lim }, used, admin, premium] = await Promise.all([
    db.from("user_limits").select("daily_ai_limit, blocked").eq("user_id", auth.user.id).maybeSingle(),
    db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("status", "ok")
      .eq("cached", false)
      .gte("created_at", dayStart.toISOString()),
    isAdmin(auth.user),
    isPremium(auth.user.id),
  ]);
  const limit = lim?.daily_ai_limit ?? (premium ? settings.premium_daily_ai_limit : settings.default_daily_ai_limit);
  const count = used.count ?? 0;
  return json({
    ai_available: settings.ai_enabled && geminiConfigured() && !lim?.blocked,
    blocked: !!lim?.blocked,
    quota: { limit, used: count, remaining: Math.max(0, limit - count) },
    premium,
    announcement: settings.announcement,
    is_admin: admin,
    // Tarayıcı / ana ekrana eklenen web uygulaması için Web Push (VAPID); mağaza uygulaması için FCM.
    web_push_available: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    push_available: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) || fcmConfigured(),
    fcm_available: fcmConfigured(),
  });
}
