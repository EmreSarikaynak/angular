"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAll, fetchRange, subscribe } from "./store";
import type { Activity, BodyMeasurement, DailyLog, CycleLog, FastingSession, Favorite, FoodEntry, HealthRing, MealPlan, Supplement, SupplementLog, UserRecipe, WaterLog } from "../types";

/** Asenkron veri yükler; veri katmanında değişiklik olduğunda sessizce yeniler. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async (silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const result = await loaderRef.current();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run(false);
    return subscribe(() => void run(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: () => run(true) };
}

export interface RangeData {
  food: FoodEntry[];
  water: WaterLog[];
  activities: Activity[];
  daily: DailyLog[];
  rings: HealthRing[];
}

export async function loadRange(from: string, to: string): Promise<RangeData> {
  const [food, water, activities, daily, rings] = await Promise.all([
    fetchRange<FoodEntry & { [k: string]: unknown }>("food_entries", from, to, "consumed_at"),
    fetchRange<WaterLog & { [k: string]: unknown }>("water_logs", from, to, "logged_at"),
    fetchRange<Activity & { [k: string]: unknown }>("activities", from, to, "started_at"),
    fetchRange<DailyLog & { [k: string]: unknown }>("daily_logs", from, to),
    fetchRange<HealthRing & { [k: string]: unknown }>("health_rings", from, to),
  ]);
  // Postgres numeric alanları metin olarak gelebilir; sayıya çevir.
  return {
    food: food.map(numFood),
    water: water.map((w) => ({ ...w, amount_ml: Number(w.amount_ml) })),
    activities: activities.map((a) => ({ ...a, duration_min: Number(a.duration_min), kcal_burned: Number(a.kcal_burned), distance_km: a.distance_km == null ? null : Number(a.distance_km) })),
    daily: daily.map((d) => ({ ...d, sleep_hours: d.sleep_hours == null ? null : Number(d.sleep_hours) })),
    rings: rings.map((r) => ({ ...r, distance_km: r.distance_km == null ? null : Number(r.distance_km) })),
  };
}

function numFood(f: FoodEntry): FoodEntry {
  return {
    ...f,
    kcal: Number(f.kcal),
    protein_g: Number(f.protein_g),
    carbs_g: Number(f.carbs_g),
    fat_g: Number(f.fat_g),
    sugar_g: Number(f.sugar_g),
    fiber_g: Number(f.fiber_g),
    salt_g: Number(f.salt_g),
    alcohol_g: Number(f.alcohol_g),
    grams: f.grams == null ? null : Number(f.grams),
    volume_ml: f.volume_ml == null ? null : Number(f.volume_ml),
    abv: f.abv == null ? null : Number(f.abv),
    caffeine_mg: Number(f.caffeine_mg ?? 0),
  };
}

export function useRange(from: string, to: string) {
  return useData(() => loadRange(from, to), [from, to]);
}

export function useDay(date: string) {
  return useRange(date, date);
}

export function useBody() {
  return useData(async () => {
    const rows = await fetchAll<BodyMeasurement & { [k: string]: unknown }>("body_measurements", "entry_date", true);
    const n = (v: unknown) => (v == null ? null : Number(v));
    return rows.map((r) => ({ ...r, weight_kg: n(r.weight_kg), waist_cm: n(r.waist_cm), hip_cm: n(r.hip_cm), chest_cm: n(r.chest_cm), body_fat_pct: n(r.body_fat_pct), bmi: n(r.bmi) })) as BodyMeasurement[];
  }, []);
}

export function useFavorites() {
  return useData(() => fetchAll<Favorite & { [k: string]: unknown }>("favorites", "use_count", false) as Promise<Favorite[]>, []);
}

export function useSupplements() {
  return useData(() => fetchAll<Supplement & { [k: string]: unknown }>("supplements", "created_at", true) as Promise<Supplement[]>, []);
}

export function useSupplementLogs(from: string, to: string) {
  return useData(() => fetchRange<SupplementLog & { [k: string]: unknown }>("supplement_logs", from, to) as Promise<SupplementLog[]>, [from, to]);
}

export function useFasting(from: string, to: string) {
  return useData(async () => {
    const rows = await fetchRange<FastingSession & { [k: string]: unknown }>("fasting_sessions", from, to, "started_at");
    return rows.map((r) => ({ ...r, target_hours: Number(r.target_hours) })) as FastingSession[];
  }, [from, to]);
}

export function useMealPlans() {
  return useData(() => fetchAll<MealPlan & { [k: string]: unknown }>("meal_plans", "created_at", false) as Promise<MealPlan[]>, []);
}

export function useUserRecipes() {
  return useData(async () => {
    const rows = await fetchAll<UserRecipe & { [k: string]: unknown }>("user_recipes", "created_at", false);
    return rows.map((r) => ({ ...r, servings: Number(r.servings) })) as UserRecipe[];
  }, []);
}

export function useCycleLogs() {
  return useData(() => fetchAll<CycleLog & { [k: string]: unknown }>("cycle_logs", "entry_date", true) as Promise<CycleLog[]>, []);
}
