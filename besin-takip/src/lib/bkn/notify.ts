import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { adminClient, logError } from "../supabase/server";
import { addDays } from "../dates";
import { dayRows } from "../stats";
import type { Activity, DailyLog, FoodEntry, HealthRing, Profile, Supplement, SupplementLog, WaterLog } from "../types";
import { proteinGap, trendInsights, type InsightKey } from "./insights";
import { insightNotice, proteinNotice, summaryNotice, supplementNotice, waterNotice, type Notice } from "./messages";
import { pickRecipes } from "./recipes";

export function localParts(tz: string, d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = Number(get("hour")) % 24;
    const minute = Number(get("minute"));
    return { date: `${get("year")}-${get("month")}-${get("day")}`, hour, minute, minutes: hour * 60 + minute, weekday: get("weekday"), day: Number(get("day")) };
  } catch {
    return localParts("Europe/Istanbul", d);
  }
}

const INSIGHT_PRIORITY: InsightKey[] = ["protein_low", "kcal_high", "water_low", "sugar_high", "salt_high", "kcal_low", "fat_high", "fiber_low", "steps_low", "sleep_low"];
/** Alınmayan takviye için en fazla kaç bildirim (ilk + tekrarlar). */
const MAX_SUPPLEMENT_ATTEMPTS = 4;
/** Saati geçen takviye en fazla bu kadar dakika boyunca hatırlatılır. */
const SUPPLEMENT_WINDOW_MIN = 180;

type P = Profile & { last_reminder_at: string | null };

/**
 * Tüm hatırlatmaları çalıştırır: su, takviye (alınmadıysa motive edici tekrarlar), protein açığı,
 * son günlerin eğilimi ve haftalık/aylık performans özeti. Zamanlayıcı tarafından düzenli çağrılır.
 * Her bildirim notification_log tablosundaki benzersiz anahtar sayesinde yalnızca bir kez gönderilir.
 */
export async function runReminders(now = new Date()) {
  const db = adminClient();
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const counts = { users: 0, water: 0, supplement: 0, protein: 0, insight: 0, summary: 0, failed: 0 };

  const { data: subs } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").limit(20000);
  const byUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  if (!byUser.size) return counts;
  const { data: profiles } = await db.from("profiles").select("*").in("id", [...byUser.keys()]);

  const push = async (userId: string, notice: Notice, tag: string) => {
    let delivered = false;
    for (const s of byUser.get(userId) ?? []) {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...notice, tag }), { TTL: 3600 });
        delivered = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else {
          counts.failed++;
          await logError("push", (e as Error).message, { status }, userId);
        }
      }
    }
    return delivered;
  };
  /** Bildirimi "gönderildi" olarak ayırır; aynı anahtar daha önce kullanıldıysa false döner. */
  const claim = async (userId: string, kind: string, key: string) => {
    const { error } = await db.from("notification_log").insert({ user_id: userId, kind, key });
    return !error;
  };

  for (const p of (profiles ?? []) as P[]) {
    counts.users++;
    const lang = p.language === "en" ? "en" : "tr";
    const t = localParts(p.timezone, now);
    const inWindow = p.reminder_start_hour <= p.reminder_end_hour ? t.hour >= p.reminder_start_hour && t.hour < p.reminder_end_hour : t.hour >= p.reminder_start_hour || t.hour < p.reminder_end_hour;

    try {
      // ── Takviyeler ────────────────────────────────────────────────────────
      if (p.notify_supplements) {
        const [{ data: supps }, { data: logs }] = await Promise.all([
          db.from("supplements").select("*").eq("user_id", p.id).eq("active", true),
          db.from("supplement_logs").select("supplement_id, time_slot").eq("user_id", p.id).eq("entry_date", t.date),
        ]);
        for (const s of (supps ?? []) as Supplement[]) {
          for (const slot of s.times) {
            const [h, m] = slot.split(":").map(Number);
            const elapsed = t.minutes - (h * 60 + m);
            if (elapsed < 0 || elapsed > SUPPLEMENT_WINDOW_MIN) continue;
            if ((logs as Pick<SupplementLog, "supplement_id" | "time_slot">[] | null)?.some((l) => l.supplement_id === s.id && l.time_slot === slot)) continue;
            const attempt = p.supplement_nag_min > 0 ? Math.min(MAX_SUPPLEMENT_ATTEMPTS - 1, Math.floor(elapsed / p.supplement_nag_min)) : 0;
            if (!(await claim(p.id, "supplement", `${s.id}:${t.date}:${slot}:${attempt}`))) continue;
            if (await push(p.id, supplementNotice(lang, s.name, s.dose, attempt), `bkn-supp-${s.id}-${slot}`)) counts.supplement++;
          }
        }
      }

      if (!inWindow) continue;

      // ── Su ────────────────────────────────────────────────────────────────
      if (p.reminder_enabled) {
        const last = p.last_reminder_at ? new Date(p.last_reminder_at).getTime() : 0;
        if (now.getTime() - last >= (p.reminder_interval_min - 3) * 60_000) {
          const { data: water } = await db.from("water_logs").select("amount_ml").eq("user_id", p.id).eq("entry_date", t.date);
          const total = (water ?? []).reduce((s, w) => s + w.amount_ml, 0);
          const target = p.water_target_ml ?? 2000;
          if (total < target) {
            await db.from("profiles").update({ last_reminder_at: now.toISOString() }).eq("id", p.id);
            if (await push(p.id, waterNotice(lang, target - total, Math.floor(t.minutes / 30)), "bkn-water")) counts.water++;
          }
        }
      }

      // ── Protein açığı ─────────────────────────────────────────────────────
      if (p.notify_protein && p.protein_target_g && t.hour >= p.protein_check_hour && t.hour < p.protein_check_hour + 3) {
        const { data: food } = await db.from("food_entries").select("protein_g, kcal").eq("user_id", p.id).eq("entry_date", t.date);
        const protein = (food ?? []).reduce((s, f) => s + Number(f.protein_g), 0);
        const kcal = (food ?? []).reduce((s, f) => s + Number(f.kcal), 0);
        const gap = proteinGap(protein, p.protein_target_g, t.hour);
        // Hiç kayıt girmemiş kullanıcıya "protein eksik" denmez; önce kayıt hatırlatması anlamsız olur.
        if (gap.behind && (food ?? []).length > 0 && (await claim(p.id, "protein", t.date))) {
          const recipe = pickRecipes("high_protein", { allergies: p.allergies, diets: p.diet_preferences, maxKcal: Math.max(250, (p.kcal_target ?? 2000) - kcal), limit: 1 })[0];
          if (await push(p.id, proteinNotice(lang, gap.remaining, recipe?.name[lang] ?? (lang === "en" ? "a protein-rich meal" : "proteinli bir öğün"), t.day), "bkn-protein")) counts.protein++;
        }
      }

      // ── Son günlerin eğilimi (aynı konu en erken 3 günde bir) ──────────────
      if (p.notify_insights && t.hour >= 10 && t.hour < 13) {
        const from = addDays(t.date, -3);
        const to = addDays(t.date, -1);
        const q = <T,>(table: string, cols: string) => db.from(table).select(cols).eq("user_id", p.id).gte("entry_date", from).lte("entry_date", to) as unknown as PromiseLike<{ data: T[] | null }>;
        const [food, water, acts, daily, rings, recent] = await Promise.all([
          q<FoodEntry>("food_entries", "entry_date, meal, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g, alcohol_g"),
          q<WaterLog>("water_logs", "entry_date, amount_ml"),
          q<Activity>("activities", "entry_date, type, duration_min, distance_km, kcal_burned"),
          q<DailyLog>("daily_logs", "entry_date, steps, sleep_hours"),
          q<HealthRing>("health_rings", "entry_date, move_kcal, steps"),
          db.from("notification_log").select("key").eq("user_id", p.id).eq("kind", "insight").gte("sent_at", new Date(now.getTime() - 2.5 * 86_400_000).toISOString()),
        ]);
        const num = (f: FoodEntry) => ({ ...f, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), sugar_g: Number(f.sugar_g), fiber_g: Number(f.fiber_g), salt_g: Number(f.salt_g), alcohol_g: Number(f.alcohol_g) });
        const rows = dayRows(from, to, {
          food: (food.data ?? []).map(num),
          water: water.data ?? [],
          activities: (acts.data ?? []).map((a) => ({ ...a, kcal_burned: Number(a.kcal_burned), duration_min: Number(a.duration_min) })),
          daily: (daily.data ?? []).map((d) => ({ ...d, sleep_hours: d.sleep_hours == null ? null : Number(d.sleep_hours) })),
          rings: rings.data ?? [],
        }, p);
        const recentKeys = new Set((recent.data ?? []).map((r) => r.key.split(":")[0]));
        const found = trendInsights(rows, p).filter((i) => !recentKeys.has(i.key));
        const pick = INSIGHT_PRIORITY.map((k) => found.find((i) => i.key === k)).find(Boolean);
        if (pick && (await claim(p.id, "insight", `${pick.key}:${t.date}`))) {
          if (await push(p.id, insightNotice(lang, pick), "bkn-insight")) counts.insight++;
        }
      }

      // ── Performans özeti: pazartesi haftalık, ayın 1'i aylık ───────────────
      if (p.notify_summary && t.hour >= 9 && t.hour < 12) {
        if (t.day === 1 && (await claim(p.id, "summary", `month:${t.date.slice(0, 7)}`))) {
          if (await push(p.id, summaryNotice(lang, "month"), "bkn-summary")) counts.summary++;
        } else if (t.weekday === "Mon" && (await claim(p.id, "summary", `week:${t.date}`))) {
          if (await push(p.id, summaryNotice(lang, "week"), "bkn-summary")) counts.summary++;
        }
      }
    } catch (e) {
      counts.failed++;
      await logError("reminders", (e as Error).message, null, p.id);
    }
  }

  // Eski kayıtları temizle (40 günden eski).
  await db.from("notification_log").delete().lt("sent_at", new Date(now.getTime() - 40 * 86_400_000).toISOString());
  return counts;
}
