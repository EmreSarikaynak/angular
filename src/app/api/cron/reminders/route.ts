import { json, logError } from "@/lib/supabase/server";
import { runReminders } from "@/lib/bkn/notify";
import { fcmConfigured } from "@/lib/bkn/fcm";

export const maxDuration = 60;

/**
 * BKNY hatırlatmaları: su, takviye, protein açığı, eğilim uyarıları ve performans özeti.
 * Zamanlayıcı (Vercel Cron vb.) düzenli çağırır:  Authorization: Bearer <CRON_SECRET>
 * Takviye saatlerinin dakikliği çağrı sıklığına bağlıdır (öneri: 5–15 dakikada bir).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const webPush = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!webPush && !fcmConfigured()) return json({ error: "push_not_configured" }, 503);
  try {
    return json({ ok: true, ...(await runReminders()) });
  } catch (e) {
    await logError("reminders", (e as Error).message);
    return json({ error: "server_error" }, 500);
  }
}
