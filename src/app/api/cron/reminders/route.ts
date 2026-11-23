import { timingSafeEqual } from "node:crypto";
import { json, logError } from "@/lib/supabase/server";
import { runReminders } from "@/lib/bkn/notify";
import { fcmConfigured } from "@/lib/bkn/fcm";

export const maxDuration = 60;

/**
 * BKNY hatırlatmaları: su, takviye, protein açığı, eğilim uyarıları ve performans özeti.
 * Zamanlayıcı (Vercel Cron vb.) düzenli çağırır:  Authorization: Bearer <CRON_SECRET>
 * Takviye saatlerinin dakikliği çağrı sıklığına bağlıdır (öneri: 15 dakikada bir; bildirim saatleri 15 dakikalık adımlarla ayarlanır).
 */
/** Sabit sürede karşılaştırma: gizli anahtar, yanıt süresinden tahmin edilemesin. */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"), process.env.CRON_SECRET)) return json({ error: "unauthorized" }, 401);
  const webPush = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  if (!webPush && !fcmConfigured()) return json({ error: "push_not_configured" }, 503);
  try {
    return json({ ok: true, ...(await runReminders()) });
  } catch (e) {
    await logError("reminders", (e as Error).message);
    return json({ error: "server_error" }, 500);
  }
}
