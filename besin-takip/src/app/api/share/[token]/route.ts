import { createHash } from "node:crypto";
import { adminClient, json, serverConfigured } from "@/lib/supabase/server";
import { addDays, ageFrom } from "@/lib/dates";
import { activityStats, adherence, avg, dayRows, topFoods } from "@/lib/stats";
import { localParts } from "@/lib/bkn/notify";
import type { Activity, BodyMeasurement, DailyLog, FoodEntry, HealthRing, Profile, WaterLog } from "@/lib/types";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Paylaşım bağlantısının salt okunur verisi. Kimlik doğrulama yoktur; erişim, bağlantıdaki
 * 256 bitlik gizli belirteçle sağlanır. Süresi dolmuş ya da iptal edilmiş bağlantı 404 döner.
 * Yalnızca kullanıcının bağlantıyı oluştururken seçtiği bölümler gönderilir; soyad, e-posta,
 * doğum tarihi, fotoğraflar, notlar ve sohbet geçmişi hiçbir zaman paylaşılmaz.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]">) {
  const { token } = await ctx.params;
  if (!serverConfigured() || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return json({ error: "not_found" }, 404);
  const db = adminClient();
  const { data: link } = await db.from("share_links").select("*").eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return json({ error: "not_found" }, 404);

  const { data: profile } = await db.from("profiles").select("*").eq("id", link.user_id).maybeSingle();
  const p = profile as Profile | null;
  if (!p) return json({ error: "not_found" }, 404);
  const to = localParts(p.timezone).date;
  const from = addDays(to, -(link.days - 1));
  const q = <T,>(table: string, cols: string) => db.from(table).select(cols).eq("user_id", link.user_id).gte("entry_date", from).lte("entry_date", to).limit(10000) as unknown as PromiseLike<{ data: T[] | null }>;
  const [food, water, acts, daily, rings, body] = await Promise.all([
    q<FoodEntry>("food_entries", "entry_date, consumed_at, meal, name, grams, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g, alcohol_g"),
    q<WaterLog>("water_logs", "entry_date, amount_ml"),
    q<Activity>("activities", "entry_date, type, duration_min, distance_km, kcal_burned"),
    q<DailyLog>("daily_logs", link.include_wellbeing ? "entry_date, steps, sleep_hours, sleep_quality, mood, energy, stress" : "entry_date, steps"),
    q<HealthRing>("health_rings", "entry_date, move_kcal, steps"),
    link.include_body ? q<BodyMeasurement>("body_measurements", "entry_date, weight_kg, waist_cm, hip_cm, chest_cm, body_fat_pct, bmi") : Promise.resolve({ data: [] as BodyMeasurement[] }),
  ]);
  const foods = (food.data ?? []).map((f) => ({ ...f, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), sugar_g: Number(f.sugar_g), fiber_g: Number(f.fiber_g), salt_g: Number(f.salt_g), alcohol_g: Number(f.alcohol_g) }));
  const activities = (acts.data ?? []).map((a) => ({ ...a, kcal_burned: Number(a.kcal_burned), duration_min: Number(a.duration_min) }));
  const rows = dayRows(from, to, { food: foods, water: water.data ?? [], activities, daily: (daily.data ?? []).map((d) => ({ ...d, sleep_hours: d.sleep_hours == null ? null : Number(d.sleep_hours) })), rings: rings.data ?? [] }, p);
  const logged = rows.filter((r) => r.logged);

  await db.from("share_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count ?? 0) + 1 }).eq("id", link.id);

  return json(
    {
      first_name: p.first_name,
      label: link.label,
      from,
      to,
      expires_at: link.expires_at,
      language: p.language,
      sections: { meals: link.include_meals, body: link.include_body, wellbeing: link.include_wellbeing },
      profile: {
        age: p.birth_date ? ageFrom(p.birth_date) : null,
        sex: p.sex,
        height_cm: p.height_cm,
        goal: p.goal,
        activity_level: p.activity_level,
        allergies: p.allergies,
        diet_preferences: p.diet_preferences,
        targets: { kcal: p.kcal_target, protein_g: p.protein_target_g, carbs_g: p.carbs_target_g, fat_g: p.fat_target_g, water_ml: p.water_target_ml, steps: p.steps_target },
        ...(link.include_body ? { start_weight_kg: p.start_weight_kg, weight_kg: p.weight_kg, target_weight_kg: p.target_weight_kg } : {}),
      },
      averages: logged.length
        ? { kcal: Math.round(avg(logged.map((r) => r.intake.kcal))), protein_g: r1(avg(logged.map((r) => r.intake.protein_g))), carbs_g: r1(avg(logged.map((r) => r.intake.carbs_g))), fat_g: r1(avg(logged.map((r) => r.intake.fat_g))), sugar_g: r1(avg(logged.map((r) => r.intake.sugar_g))), fiber_g: r1(avg(logged.map((r) => r.intake.fiber_g))), salt_g: r1(avg(logged.map((r) => r.intake.salt_g))) }
        : null,
      adherence: adherence(rows, p),
      activity: activityStats(activities),
      days: rows
        .filter((r) => r.logged || r.water_ml > 0 || r.burned_kcal > 0 || r.steps > 0)
        .map((r) => ({
          date: r.date,
          kcal: Math.round(r.intake.kcal),
          protein_g: Math.round(r.intake.protein_g),
          carbs_g: Math.round(r.intake.carbs_g),
          fat_g: Math.round(r.intake.fat_g),
          water_ml: r.water_ml,
          burned_kcal: r.burned_kcal,
          steps: r.steps,
          ...(link.include_wellbeing ? { sleep_hours: r.daily?.sleep_hours ?? null, mood: r.daily?.mood ?? null, energy: r.daily?.energy ?? null, stress: r.daily?.stress ?? null } : {}),
        })),
      top_foods: topFoods(foods.filter((f) => f.meal !== "drink"), 8).byCount.map((f) => ({ name: f.name, count: f.count, kcal: Math.round(f.kcal) })),
      meals: link.include_meals ? foods.sort((a, b) => a.consumed_at.localeCompare(b.consumed_at)).map((f) => ({ date: f.entry_date, meal: f.meal, name: f.name, grams: f.grams == null ? null : Number(f.grams), kcal: Math.round(f.kcal), protein_g: f.protein_g })) : null,
      weights: link.include_body ? (body.data ?? []).filter((b) => b.weight_kg != null).map((b) => ({ date: b.entry_date, weight_kg: Number(b.weight_kg), bmi: b.bmi == null ? null : Number(b.bmi), waist_cm: b.waist_cm == null ? null : Number(b.waist_cm), body_fat_pct: b.body_fat_pct == null ? null : Number(b.body_fat_pct) })) : null,
    },
    200,
    { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" },
  );
}
