import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, ageFrom } from "../dates";
import { sumNutrients } from "../nutrition/calc";
import type { Activity, BodyMeasurement, DailyLog, FoodEntry, Profile, WaterLog } from "../types";

/**
 * Asistana gönderilecek bağlamı kullanıcının kendi (RLS'li) istemcisiyle derler.
 * Veri en aza indirgenir: soyad, e-posta, doğum tarihi, fotoğraflar ve serbest notlar GÖNDERİLMEZ;
 * yalnızca yaş, hedefler ve günlük özetler gider.
 */
export async function buildAssistantContext(db: SupabaseClient, today: string) {
  const from30 = addDays(today, -29);
  const from14 = addDays(today, -13);

  const [profileR, foodR, waterR, actR, dailyR, bodyR] = await Promise.all([
    db.from("profiles").select("*").maybeSingle(),
    db
      .from("food_entries")
      .select("entry_date, consumed_at, meal, name, grams, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g, alcohol_g")
      .gte("entry_date", from30)
      .lte("entry_date", today)
      .order("consumed_at")
      .limit(2000),
    db.from("water_logs").select("entry_date, amount_ml").gte("entry_date", from14).lte("entry_date", today).limit(2000),
    db.from("activities").select("entry_date, type, duration_min, distance_km, kcal_burned").gte("entry_date", from14).lte("entry_date", today).limit(500),
    db.from("daily_logs").select("entry_date, steps, sleep_hours, sleep_quality, mood, energy, stress").gte("entry_date", from14).lte("entry_date", today),
    db.from("body_measurements").select("entry_date, weight_kg, waist_cm, body_fat_pct, bmi").order("entry_date", { ascending: false }).limit(20),
  ]);

  const p = profileR.data as Profile | null;
  const food = (foodR.data ?? []) as FoodEntry[];
  const water = (waterR.data ?? []) as WaterLog[];
  const acts = (actR.data ?? []) as Activity[];
  const daily = (dailyR.data ?? []) as DailyLog[];
  const body = (bodyR.data ?? []) as BodyMeasurement[];

  const byDay = new Map<string, FoodEntry[]>();
  for (const f of food) byDay.set(f.entry_date, [...(byDay.get(f.entry_date) ?? []), f]);

  const days = [];
  for (let d = from14; d <= today; d = addDays(d, 1)) {
    const n = sumNutrients(byDay.get(d) ?? []);
    const dl = daily.find((x) => x.entry_date === d);
    const hasAny = byDay.has(d) || water.some((w) => w.entry_date === d) || acts.some((a) => a.entry_date === d) || !!dl;
    if (!hasAny) continue;
    days.push({
      date: d,
      kcal: Math.round(n.kcal),
      protein_g: Math.round(n.protein_g),
      carbs_g: Math.round(n.carbs_g),
      fat_g: Math.round(n.fat_g),
      sugar_g: Math.round(n.sugar_g),
      fiber_g: Math.round(n.fiber_g),
      alcohol_g: Math.round(n.alcohol_g),
      water_ml: water.filter((w) => w.entry_date === d).reduce((s, w) => s + w.amount_ml, 0),
      exercise_kcal: Math.round(acts.filter((a) => a.entry_date === d).reduce((s, a) => s + Number(a.kcal_burned), 0)),
      activities: acts.filter((a) => a.entry_date === d).map((a) => `${a.type} ${a.duration_min}min`),
      steps: dl?.steps ?? null,
      sleep_hours: dl?.sleep_hours ?? null,
      sleep_quality: dl?.sleep_quality ?? null,
      mood: dl?.mood ?? null,
      energy: dl?.energy ?? null,
      stress: dl?.stress ?? null,
    });
  }

  const topMap = new Map<string, { count: number; kcal: number }>();
  for (const f of food) {
    const k = f.name.trim().toLocaleLowerCase("tr");
    const cur = topMap.get(k) ?? { count: 0, kcal: 0 };
    topMap.set(k, { count: cur.count + 1, kcal: cur.kcal + Number(f.kcal) });
  }
  const top = [...topMap.entries()]
    .sort((a, b) => b[1].kcal - a[1].kcal)
    .slice(0, 15)
    .map(([name, v]) => ({ name, times: v.count, total_kcal: Math.round(v.kcal) }));

  const todayEntries = (byDay.get(today) ?? []).map((f) => ({
    meal: f.meal,
    name: f.name,
    grams: f.grams,
    kcal: Math.round(Number(f.kcal)),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
  }));

  return {
    today,
    profile: p
      ? {
          first_name: p.first_name,
          age: p.birth_date ? ageFrom(p.birth_date) : null,
          sex: p.sex,
          height_cm: p.height_cm,
          start_weight_kg: p.start_weight_kg,
          current_weight_kg: p.weight_kg,
          target_weight_kg: p.target_weight_kg,
          goal: p.goal,
          activity_level: p.activity_level,
          allergies: p.allergies,
          diet_preferences: p.diet_preferences,
          daily_targets: {
            kcal: p.kcal_target,
            protein_g: p.protein_target_g,
            carbs_g: p.carbs_target_g,
            fat_g: p.fat_target_g,
            water_ml: p.water_target_ml,
            steps: p.steps_target,
          },
        }
      : null,
    today_entries: todayEntries,
    last_14_days: days,
    top_foods_by_calories_30d: top,
    weight_history: body.filter((b) => b.weight_kg != null).map((b) => ({ date: b.entry_date, weight_kg: b.weight_kg, bmi: b.bmi, waist_cm: b.waist_cm, body_fat_pct: b.body_fat_pct })),
  };
}
