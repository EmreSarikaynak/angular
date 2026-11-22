import { stepsKcal } from "./nutrition/activities";
import { sumNutrients } from "./nutrition/calc";
import type { Activity, DailyLog, FoodEntry, Nutrients, Profile, WaterLog } from "./types";

export interface DaySummary {
  intake: Nutrients;
  water_ml: number;
  exercise_kcal: number;
  steps: number;
  steps_kcal: number;
  /** Aktivite + (aktivitelerle çakışmayan) adımlardan net yakılan enerji. */
  burned_kcal: number;
  target_kcal: number;
  /** Egzersiz kalorileri bütçeye ekleniyorsa hedef + yakılan. */
  budget_kcal: number;
  remaining_kcal: number;
}

export function summarizeDay(
  date: string,
  data: { food: FoodEntry[]; water: WaterLog[]; activities: Activity[]; daily: DailyLog[] },
  profile: Pick<Profile, "kcal_target" | "weight_kg" | "add_exercise_calories"> | null,
): DaySummary {
  const food = data.food.filter((f) => f.entry_date === date);
  const acts = data.activities.filter((a) => a.entry_date === date);
  const daily = data.daily.find((d) => d.entry_date === date);
  const intake = sumNutrients(food);
  const water = data.water.filter((w) => w.entry_date === date).reduce((s, w) => s + w.amount_ml, 0);
  const exercise = acts.reduce((s, a) => s + a.kcal_burned, 0);
  const steps = daily?.steps ?? 0;
  const sk = stepsKcal(steps, profile?.weight_kg ?? 70, acts);
  const burned = Math.round(exercise + sk);
  const target = profile?.kcal_target ?? 0;
  const budget = target + (profile?.add_exercise_calories ? burned : 0);
  return {
    intake,
    water_ml: water,
    exercise_kcal: Math.round(exercise),
    steps,
    steps_kcal: sk,
    burned_kcal: burned,
    target_kcal: target,
    budget_kcal: budget,
    remaining_kcal: Math.round(budget - intake.kcal),
  };
}
