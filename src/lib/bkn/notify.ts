import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { adminClient, logError } from "../supabase/server";
import { addDays } from "../dates";
import { dayRows } from "../stats";
import type { Activity, DailyLog, FoodEntry, HealthRing, Profile, Supplement, SupplementLog, WaterLog } from "../types";
import { proteinGap, trendInsights, type InsightKey } from "./insights";
import { eveningNotice, insightNotice, proteinNotice, stockNotice, summaryNotice, supplementNotice, waterNotice, type Notice } from "./messages";
import { LOW_STOCK_DAYS, stockDaysLeft } from "./fasting";
import { inEatingWindow } from "./ramadan";
import { fcmConfigured, sendFcm } from "./fcm";
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
  const webPushOn = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const fcmOn = fcmConfigured();
  if (webPushOn) setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const counts = { users: 0, water: 0, supplement: 0, protein: 0, insight: 0, summary: 0, evening: 0, stock: 0, failed: 0 };

  // Web (tarayıcı/PWA) abonelikleri ve mobil uygulama cihaz belirteçleri.
  const { data: subs } = webPushOn ? await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").limit(20000) : { data: [] };
  const { data: devices } = fcmOn ? await db.from("device_tokens").select("id, user_id, token").limit(20000) : { data: [] };
  const byUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  const devicesByUser = new Map<string, NonNullable<typeof devices>>();
  for (const d of devices ?? []) devicesByUser.set(d.user_id, [...(devicesByUser.get(d.user_id) ?? []), d]);
  const targets = new Set([...byUser.keys(), ...devicesByUser.keys()]);
  if (!targets.size) return counts;
  const { data: profiles } = await db.from("profiles").select("*").in("id", [...targets]);

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
    for (const d of devicesByUser.get(userId) ?? []) {
      const result = await sendFcm(d.token, { title: notice.title, body: notice.body, url: notice.url, tag });
      if (result === "sent") delivered = true;
      else if (result === "unregistered") await db.from("device_tokens").delete().eq("id", d.id);
      else counts.failed++;
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
    // Ramazan modunda su ve beslenme hatırlatmaları yalnızca iftar–sahur arasında gönderilir.
    const inWindow = p.ramadan_mode
      ? inEatingWindow(t.minutes, p.iftar_time, p.sahur_time)
      : p.reminder_start_hour <= p.reminder_end_hour
        ? t.hour >= p.reminder_start_hour && t.hour < p.reminder_end_hour
        : t.hour >= p.reminder_start_hour || t.hour < p.reminder_end_hour;
    // Ramazan modunda protein kontrolü iftardan bir saat sonra yapılır.
    const proteinHour = p.ramadan_mode ? (Number(p.iftar_time.slice(0, 2)) + 1) % 24 : p.protein_check_hour;

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

      // ── Akşam kapanışı: günün kısa özeti ──────────────────────────────────
      if (p.notify_evening && t.hour === p.evening_hour && (await claim(p.id, "evening", t.date))) {
        const [{ data: food }, { data: water }, { data: supps }, { data: logs }] = await Promise.all([
          db.from("food_entries").select("meal, protein_g").eq("user_id", p.id).eq("entry_date", t.date),
          db.from("water_logs").select("amount_ml").eq("user_id", p.id).eq("entry_date", t.date),
          db.from("supplements").select("id, times").eq("user_id", p.id).eq("active", true),
          db.from("supplement_logs").select("id").eq("user_id", p.id).eq("entry_date", t.date),
        ]);
        const planned = (supps ?? []).reduce((n, x) => n + (x.times as string[]).length, 0);
        const notice = eveningNotice(lang, {
          meals: new Set((food ?? []).filter((f) => f.meal !== "drink").map((f) => f.meal)).size,
          waterMl: (water ?? []).reduce((n, w) => n + w.amount_ml, 0),
          waterTarget: p.water_target_ml ?? 2000,
          proteinG: Math.round((food ?? []).reduce((n, f) => n + Number(f.protein_g), 0)),
          proteinTarget: p.protein_target_g ?? 0,
          supplementsLeft: Math.max(0, planned - (logs ?? []).length),
        });
        if (await push(p.id, notice, "bkn-evening")) counts.evening++;
      }

      // ── Takviye stoku azaldı (takviye başına, stok yenilenene kadar bir kez) ─
      if (p.notify_supplements && t.hour >= 10 && t.hour < 20) {
        const { data: stocked } = await db.from("supplements").select("id, name, times, active, stock_count, per_dose").eq("user_id", p.id).eq("active", true).not("stock_count", "is", null);
        for (const s of (stocked ?? []) as Supplement[]) {
          const left = stockDaysLeft(s);
          if (left == null || left > LOW_STOCK_DAYS) continue;
          // Anahtar stok adedine bağlı değil; kullanıcı stoku yenileyince kayıt silinir (aşağıda).
          if (!(await claim(p.id, "stock", s.id))) continue;
          if (await push(p.id, stockNotice(lang, s.name, left), `bkn-stock-${s.id}`)) counts.stock++;
        }
        // Stoku yeniden dolan takviyelerin "azaldı" kaydını temizle ki bir sonraki azalışta yine bildirilsin.
        const { data: sent } = await db.from("notification_log").select("id, key").eq("user_id", p.id).eq("kind", "stock");
        for (const row of sent ?? []) {
          const s = ((stocked ?? []) as Supplement[]).find((x) => x.id === row.key);
          const left = s ? stockDaysLeft(s) : null;
          if (!s || left == null || left > LOW_STOCK_DAYS) await db.from("notification_log").delete().eq("id", row.id);
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
      if (p.notify_protein && p.protein_target_g && t.hour >= proteinHour && t.hour < proteinHour + 3) {
        const { data: food } = await db.from("food_entries").select("protein_g, kcal").eq("user_id", p.id).eq("entry_date", t.date);
        const protein = (food ?? []).reduce((s, f) => s + Number(f.protein_g), 0);
        const kcal = (food ?? []).reduce((s, f) => s + Number(f.kcal), 0);
        // Ramazan modunda gün iftarla başladığı için saat bazlı beklenti yerine sabit eşik kullanılır.
        const gap = p.ramadan_mode ? { remaining: Math.max(0, Math.round(p.protein_target_g - protein)), behind: protein < p.protein_target_g * 0.4 } : proteinGap(protein, p.protein_target_g, t.hour);
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
