import { stepsKcal } from "./nutrition/activities";
import { sumNutrients } from "./nutrition/calc";
import type { Activity, DailyLog, FoodEntry, HealthRing, Nutrients, Profile, WaterLog } from "./types";

export interface DaySummary {
  intake: Nutrients;
  water_ml: number;
  exercise_kcal: number;
  steps: number;
  steps_kcal: number;
  /**
   * Günün net yakılan enerjisi. O gün için sağlık halkası (saat/telefon) kaydı varsa cihazın
   * ölçtüğü aktif kalori esas alınır; yoksa aktivite + (aktivitelerle çakışmayan) adım tahmini.
   * İkisi asla toplanmaz (çifte sayım olmaz).
   */
  burned_kcal: number;
  burned_source: "rings" | "estimate";
  target_kcal: number;
  /** Egzersiz kalorileri bütçeye ekleniyorsa hedef + yakılan. */
  budget_kcal: number;
  remaining_kcal: number;
}

export function summarizeDay(
  date: string,
  data: { food: FoodEntry[]; water: WaterLog[]; activities: Activity[]; daily: DailyLog[]; rings?: HealthRing[] },
  profile: Pick<Profile, "kcal_target" | "weight_kg" | "add_exercise_calories"> | null,
): DaySummary {
  const food = data.food.filter((f) => f.entry_date === date);
  const acts = data.activities.filter((a) => a.entry_date === date);
  const daily = data.daily.find((d) => d.entry_date === date);
  const intake = sumNutrients(food);
  const water = data.water.filter((w) => w.entry_date === date).reduce((s, w) => s + w.amount_ml, 0);
  const exercise = acts.reduce((s, a) => s + a.kcal_burned, 0);
  const ring = data.rings?.find((r) => r.entry_date === date);
  const steps = daily?.steps ?? ring?.steps ?? 0;
  const sk = stepsKcal(steps, profile?.weight_kg ?? 70, acts);
  const fromRings = ring?.move_kcal != null;
  const burned = fromRings ? Math.round(ring!.move_kcal!) : Math.round(exercise + sk);
  const target = profile?.kcal_target ?? 0;
  const budget = target + (profile?.add_exercise_calories ? burned : 0);
  return {
    intake,
    water_ml: water,
    exercise_kcal: Math.round(exercise),
    steps,
    steps_kcal: sk,
    burned_kcal: burned,
    burned_source: fromRings ? "rings" : "estimate",
    target_kcal: target,
    budget_kcal: budget,
    remaining_kcal: Math.round(budget - intake.kcal),
  };
}
