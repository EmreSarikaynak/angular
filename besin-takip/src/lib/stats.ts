import { addDays, dateRange } from "./dates";
import { summarizeDay, type DaySummary } from "./day";
import type { Activity, BodyMeasurement, DailyLog, FoodEntry, Profile, WaterLog } from "./types";

export interface RangeInput {
  food: FoodEntry[];
  water: WaterLog[];
  activities: Activity[];
  daily: DailyLog[];
}

export interface DayRow extends DaySummary {
  date: string;
  logged: boolean;
  daily?: DailyLog;
}

export function dayRows(from: string, to: string, data: RangeInput, profile: Profile | null): DayRow[] {
  const foodDays = new Set(data.food.map((f) => f.entry_date));
  return dateRange(from, to).map((date) => ({
    date,
    ...summarizeDay(date, data, profile),
    logged: foodDays.has(date),
    daily: data.daily.find((d) => d.entry_date === date),
  }));
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Yıllık görünüm için günleri aya göre topla (kayıt girilen günlerin ortalaması). */
export function monthlyBuckets(rows: DayRow[]) {
  const map = new Map<string, DayRow[]>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([month, list]) => {
    const logged = list.filter((r) => r.logged);
    const watered = list.filter((r) => r.water_ml > 0);
    return {
      key: month,
      kcal: Math.round(avg(logged.map((r) => r.intake.kcal))),
      protein_g: Math.round(avg(logged.map((r) => r.intake.protein_g))),
      carbs_g: Math.round(avg(logged.map((r) => r.intake.carbs_g))),
      fat_g: Math.round(avg(logged.map((r) => r.intake.fat_g))),
      water_ml: Math.round(avg(watered.map((r) => r.water_ml))),
      burned_kcal: Math.round(list.reduce((s, r) => s + r.burned_kcal, 0)),
      alcohol_g: Math.round(list.reduce((s, r) => s + r.intake.alcohol_g, 0) * 10) / 10,
    };
  });
}

export interface Adherence {
  loggedDays: number;
  totalDays: number;
  calories: number | null;
  protein: number | null;
  water: number | null;
  steps: number | null;
}

/** Hedeflere uyum: kalori hedefin ±%10'u içinde, protein ≥ %90, su ≥ hedef, adım ≥ hedef olan günlerin oranı. */
export function adherence(rows: DayRow[], profile: Profile | null): Adherence {
  const logged = rows.filter((r) => r.logged);
  const ratio = (list: DayRow[], ok: (r: DayRow) => boolean) => (list.length ? Math.round((list.filter(ok).length / list.length) * 100) : null);
  const watered = rows.filter((r) => r.water_ml > 0);
  const stepped = rows.filter((r) => r.steps > 0);
  return {
    loggedDays: logged.length,
    totalDays: rows.length,
    calories: profile?.kcal_target ? ratio(logged, (r) => Math.abs(r.intake.kcal - r.budget_kcal) <= r.budget_kcal * 0.1) : null,
    protein: profile?.protein_target_g ? ratio(logged, (r) => r.intake.protein_g >= (profile.protein_target_g ?? 0) * 0.9) : null,
    water: profile?.water_target_ml ? ratio(watered, (r) => r.water_ml >= (profile.water_target_ml ?? 0)) : null,
    steps: profile?.steps_target ? ratio(stepped, (r) => r.steps >= profile.steps_target) : null,
  };
}

export function topFoods(food: FoodEntry[], limit = 10) {
  const map = new Map<string, { name: string; count: number; kcal: number }>();
  for (const f of food) {
    const key = f.name.trim().toLocaleLowerCase("tr");
    const cur = map.get(key) ?? { name: f.name.trim(), count: 0, kcal: 0 };
    cur.count++;
    cur.kcal += f.kcal;
    map.set(key, cur);
  }
  const list = [...map.values()];
  return {
    byCount: [...list].sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, limit),
    byKcal: [...list].sort((a, b) => b.kcal - a.kcal).slice(0, limit),
  };
}

export function activityStats(activities: Activity[]) {
  const byType = new Map<string, { type: string; sessions: number; minutes: number; kcal: number }>();
  for (const a of activities) {
    const cur = byType.get(a.type) ?? { type: a.type, sessions: 0, minutes: 0, kcal: 0 };
    cur.sessions++;
    cur.minutes += a.duration_min;
    cur.kcal += a.kcal_burned;
    byType.set(a.type, cur);
  }
  return {
    sessions: activities.length,
    minutes: Math.round(activities.reduce((s, a) => s + a.duration_min, 0)),
    kcal: Math.round(activities.reduce((s, a) => s + a.kcal_burned, 0)),
    byType: [...byType.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

/** Pearson korelasyon katsayısı; en az 5 eşleşen gün yoksa null. */
export function pearson(pairs: [number, number][]): number | null {
  const n = pairs.length;
  if (n < 5) return null;
  const mx = avg(pairs.map((p) => p[0]));
  const my = avg(pairs.map((p) => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

export interface Relation {
  key: "sleep_kcal" | "sleep_energy" | "sleep_mood" | "exercise_mood" | "stress_kcal" | "kcal_weight";
  n: number;
  r: number | null;
  /** Karşılaştırma grupları (ör. az uyku / yeterli uyku günlerinde ortalama kalori). */
  a?: number;
  b?: number;
}

/** Beslenme, uyku, ruh hali, aktivite ve kilo arasındaki kişisel ilişkiler. */
export function relations(rows: DayRow[], body: BodyMeasurement[]): Relation[] {
  const out: Relation[] = [];
  const withSleep = rows.filter((r) => r.daily?.sleep_hours != null);

  const sk = withSleep.filter((r) => r.logged);
  out.push({
    key: "sleep_kcal",
    n: sk.length,
    r: pearson(sk.map((r) => [r.daily!.sleep_hours!, r.intake.kcal])),
    a: Math.round(avg(sk.filter((r) => r.daily!.sleep_hours! < 7).map((r) => r.intake.kcal))),
    b: Math.round(avg(sk.filter((r) => r.daily!.sleep_hours! >= 7).map((r) => r.intake.kcal))),
  });

  const se = withSleep.filter((r) => r.daily?.energy != null);
  out.push({ key: "sleep_energy", n: se.length, r: pearson(se.map((r) => [r.daily!.sleep_hours!, r.daily!.energy!])) });

  const sm = withSleep.filter((r) => r.daily?.mood != null);
  out.push({ key: "sleep_mood", n: sm.length, r: pearson(sm.map((r) => [r.daily!.sleep_hours!, r.daily!.mood!])) });

  const mood = rows.filter((r) => r.daily?.mood != null);
  const active = mood.filter((r) => r.exercise_kcal > 0);
  const rest = mood.filter((r) => r.exercise_kcal === 0);
  out.push({
    key: "exercise_mood",
    n: active.length >= 2 && rest.length >= 2 ? mood.length : 0,
    r: null,
    a: Math.round(avg(active.map((r) => r.daily!.mood!)) * 10) / 10,
    b: Math.round(avg(rest.map((r) => r.daily!.mood!)) * 10) / 10,
  });

  const st = rows.filter((r) => r.daily?.stress != null && r.logged);
  out.push({ key: "stress_kcal", n: st.length, r: pearson(st.map((r) => [r.daily!.stress!, r.intake.kcal])) });

  // Haftalık ortalama kalori ile sonraki ölçüme kadar kilo değişimi.
  const weights = body.filter((b) => b.weight_kg != null).sort((x, y) => x.entry_date.localeCompare(y.entry_date));
  const pairs: [number, number][] = [];
  for (let i = 1; i < weights.length; i++) {
    const prev = weights[i - 1];
    const cur = weights[i];
    const between = rows.filter((r) => r.logged && r.date > prev.entry_date && r.date <= cur.entry_date);
    const days = (new Date(cur.entry_date).getTime() - new Date(prev.entry_date).getTime()) / 86_400_000;
    if (between.length >= 3 && days > 0) pairs.push([avg(between.map((r) => r.intake.kcal)), ((cur.weight_kg! - prev.weight_kg!) / days) * 7]);
  }
  out.push({ key: "kcal_weight", n: pairs.length, r: pearson(pairs) });
  return out;
}

export function periodRange(period: "day" | "week" | "month" | "year", end: string): { from: string; to: string } {
  const span = { day: 0, week: 6, month: 29, year: 364 }[period];
  return { from: addDays(end, -span), to: end };
}
