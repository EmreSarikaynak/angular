import type { DayRow } from "../stats";
import { avg } from "../stats";
import type { Profile } from "../types";
import type { RecipeTag } from "./recipes";

export type InsightKey = "protein_low" | "kcal_high" | "kcal_low" | "sugar_high" | "salt_high" | "fat_high" | "fiber_low" | "water_low" | "steps_low" | "sleep_low";

export interface Insight {
  key: InsightKey;
  direction: "over" | "under";
  /** Dönem ortalaması ve karşılaştırıldığı hedef/eşik. */
  value: number;
  target: number;
  days: number;
  recipeTag?: RecipeTag;
}

/** Günlük şeker ve tuz için genel kabul gören üst sınırlar (DSÖ önerilerine yakın). */
export const SUGAR_LIMIT_G = 60;
export const SALT_LIMIT_G = 5;
export const FIBER_MIN_G = 20;

/**
 * Son günlerin eğilimi: hangi değer hedefin belirgin biçimde üstünde ya da altında?
 * Beslenme ölçütleri için en az 2 kayıtlı gün gerekir; tek günlük sapma uyarı üretmez.
 */
export function trendInsights(rows: DayRow[], profile: Pick<Profile, "kcal_target" | "protein_target_g" | "fat_target_g" | "fiber_target_g" | "water_target_ml" | "steps_target"> | null): Insight[] {
  const out: Insight[] = [];
  const logged = rows.filter((r) => r.logged);
  const push = (key: InsightKey, direction: Insight["direction"], value: number, target: number, days: number, recipeTag?: RecipeTag) => out.push({ key, direction, value: Math.round(value * 10) / 10, target, days, recipeTag });

  if (logged.length >= 2) {
    const n = logged.length;
    const m = (pick: (r: DayRow) => number) => avg(logged.map(pick));
    const kcal = m((r) => r.intake.kcal);
    const budget = avg(logged.map((r) => r.budget_kcal));
    if (profile?.protein_target_g && m((r) => r.intake.protein_g) < profile.protein_target_g * 0.8) push("protein_low", "under", m((r) => r.intake.protein_g), profile.protein_target_g, n, "high_protein");
    if (budget > 0 && kcal > budget * 1.1) push("kcal_high", "over", kcal, Math.round(budget), n, "low_cal");
    else if (budget > 0 && kcal < budget * 0.7) push("kcal_low", "under", kcal, Math.round(budget), n, "high_protein");
    if (m((r) => r.intake.sugar_g) > SUGAR_LIMIT_G) push("sugar_high", "over", m((r) => r.intake.sugar_g), SUGAR_LIMIT_G, n, "low_sugar");
    if (m((r) => r.intake.salt_g) > SALT_LIMIT_G) push("salt_high", "over", m((r) => r.intake.salt_g), SALT_LIMIT_G, n, "low_salt");
    if (profile?.fat_target_g && m((r) => r.intake.fat_g) > profile.fat_target_g * 1.3) push("fat_high", "over", m((r) => r.intake.fat_g), profile.fat_target_g, n, "low_fat");
    // Hedefin %80'inin altında kalan ortalama lif uyarı verir; hedef yoksa 20 g varsayılır.
    const fiberTarget = profile?.fiber_target_g ?? 25;
    if (m((r) => r.intake.fiber_g) < fiberTarget * 0.8) push("fiber_low", "under", m((r) => r.intake.fiber_g), fiberTarget, n, "high_fiber");
  }

  // Su: kayıt girilmeyen gün 0 sayılır, ancak hiç su kaydı olmayan kullanıcıya uyarı gönderilmez.
  const waterDays = rows.filter((r) => r.water_ml > 0).length;
  if (profile?.water_target_ml && rows.length >= 2 && waterDays >= 1) {
    const w = avg(rows.map((r) => r.water_ml));
    if (w < profile.water_target_ml * 0.7) push("water_low", "under", w, profile.water_target_ml, rows.length);
  }
  const stepped = rows.filter((r) => r.steps > 0);
  if (profile?.steps_target && stepped.length >= 2) {
    const s = avg(stepped.map((r) => r.steps));
    if (s < profile.steps_target * 0.6) push("steps_low", "under", s, profile.steps_target, stepped.length);
  }
  const slept = rows.filter((r) => r.daily?.sleep_hours != null);
  if (slept.length >= 2) {
    const h = avg(slept.map((r) => r.daily!.sleep_hours!));
    if (h < 6.5) push("sleep_low", "under", h, 7, slept.length);
  }
  return out;
}

/** Bugün protein hedefinin gerisinde mi? (Saat ilerledikçe beklenen pay artar.) */
export function proteinGap(proteinSoFar: number, target: number | null | undefined, hour: number): { remaining: number; behind: boolean } {
  if (!target) return { remaining: 0, behind: false };
  const remaining = Math.max(0, Math.round(target - proteinSoFar));
  const expected = hour >= 21 ? 0.9 : hour >= 18 ? 0.7 : hour >= 14 ? 0.45 : hour >= 11 ? 0.2 : 0;
  return { remaining, behind: remaining > 0 && proteinSoFar < target * expected };
}
