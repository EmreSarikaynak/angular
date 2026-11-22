import { sendNotification, setVapidDetails } from "web-push";
import { adminClient, json, logError } from "@/lib/supabase/server";

export const maxDuration = 60;

function localParts(tz: string, d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
  } catch {
    return localParts("Europe/Istanbul", d);
  }
}

/**
 * Su hatırlatmaları. Zamanlayıcı (Vercel Cron vb.) tarafından düzenli çağrılır:
 *   Authorization: Bearer <CRON_SECRET>
 * Kullanıcının saat dilimi, hatırlatma aralığı ve saat penceresi dikkate alınır;
 * günlük su hedefine ulaşmış kullanıcıya bildirim gönderilmez.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return json({ error: "push_not_configured" }, 503);
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);

  const db = adminClient();
  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, language, timezone, water_target_ml, reminder_interval_min, reminder_start_hour, reminder_end_hour, last_reminder_at")
    .eq("reminder_enabled", true)
    .limit(5000);
  if (error) return json({ error: "db_error" }, 500);

  let sent = 0;
  let skipped = 0;
  for (const p of profiles ?? []) {
    const { date, hour } = localParts(p.timezone);
    const inWindow = p.reminder_start_hour <= p.reminder_end_hour ? hour >= p.reminder_start_hour && hour < p.reminder_end_hour : hour >= p.reminder_start_hour || hour < p.reminder_end_hour;
    const last = p.last_reminder_at ? new Date(p.last_reminder_at).getTime() : 0;
    const due = Date.now() - last >= (p.reminder_interval_min - 3) * 60_000;
    if (!inWindow || !due) {
      skipped++;
      continue;
    }
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", p.id);
    if (!subs?.length) {
      skipped++;
      continue;
    }
    const { data: water } = await db.from("water_logs").select("amount_ml").eq("user_id", p.id).eq("entry_date", date);
    const total = (water ?? []).reduce((s, w) => s + w.amount_ml, 0);
    const target = p.water_target_ml ?? 2000;
    if (total >= target) {
      skipped++;
      continue;
    }
    const remaining = target - total;
    const payload = JSON.stringify(
      p.language === "en"
        ? { title: "Time for some water 💧", body: `${remaining} ml left to reach today's goal.`, url: "/water" }
        : { title: "Su içme zamanı 💧", body: `Bugünkü hedefine ${remaining} ml kaldı.`, url: "/water" },
    );
    for (const s of subs) {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else await logError("push", (e as Error).message, { status }, p.id);
      }
    }
    await db.from("profiles").update({ last_reminder_at: new Date().toISOString() }).eq("id", p.id);
  }
  return json({ ok: true, sent, skipped });
}
