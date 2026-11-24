import type { ActivityLevel, Goal, Nutrients, Sex } from "../types";
import { EMPTY_NUTRIENTS, NUTRIENT_KEYS } from "../types";

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export interface TargetInput {
  sex: Sex;
  age: number;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: Goal;
  /** Haftalık hedeflenen kilo değişimi (kg, pozitif sayı). */
  weekly_rate_kg?: number;
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  water_target_ml: number;
}

/** Mifflin-St Jeor denklemi ile bazal metabolizma hızı (kcal/gün). */
export function bmrMifflin(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Günlük hedefler.
 * - Enerji: BMR × hareketlilik katsayısı (TDEE), hedefe göre haftalık ~7700 kcal/kg açık/fazla.
 * - Güvenlik tabanı: kadınlarda 1200, erkeklerde 1500 kcal'in altına ve BMR'nin %80'inin altına inilmez.
 * - Protein: kilo verirken/alırken 1.6, korurken 1.2 g/kg. Obez kişilerde gerçek kilo yerine ayarlanmış kilo
 *   (ideal + fazlanın %25'i) kullanılır; enerjinin %30'unu ve günde 150 g'ı geçmez. Yağ: enerjinin %28'i, kalan: karbonhidrat.
 * - Su: ~33 ml/kg (1500–4000 ml arası), 50 ml'ye yuvarlanır.
 */
/** Protein hesabında kullanılan kilo: VKİ 27'ye kadar gerçek kilo, üstünde ideal kilo + fazlanın %25'i. */
export function proteinReferenceWeight(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  const ideal = 22 * m * m;
  return weightKg / (m * m) > 27 ? ideal + 0.25 * (weightKg - ideal) : weightKg;
}

/**
 * Günlük lif hedefi: 1000 kcal başına 14 g (IOM önerisi), yetişkinler için 25–38 g arasına sıkıştırılır
 * (25 g = DSÖ/EFSA genel alt sınırı). Kadınlarda üst sınır 30 g'dır.
 */
export function fiberTarget(kcal: number, sex: "male" | "female"): number {
  const max = sex === "male" ? 38 : 30;
  return Math.round(Math.min(max, Math.max(25, (kcal / 1000) * 14)));
}

export function calculateTargets(input: TargetInput): Targets {
  const bmr = bmrMifflin(input.sex, input.weight_kg, input.height_cm, input.age);
  const tdee = bmr * ACTIVITY_FACTORS[input.activity_level];
  const rate = Math.min(1, Math.max(0, input.weekly_rate_kg ?? 0.5));
  const dailyDelta = (rate * 7700) / 7;

  let kcal = tdee;
  if (input.goal === "lose") kcal = tdee - dailyDelta;
  if (input.goal === "gain") kcal = tdee + Math.min(dailyDelta, 500);

  const floor = Math.max(input.sex === "male" ? 1500 : 1200, bmr * 0.8);
  if (input.goal === "lose") kcal = Math.max(kcal, Math.min(floor, tdee));
  kcal = round5(kcal);

  const proteinPerKg = input.goal === "lose" || input.goal === "gain" ? 1.6 : 1.2;
  let protein = Math.round(proteinPerKg * proteinReferenceWeight(input.weight_kg, input.height_cm));
  // Protein enerjinin %30'unu ve günde 150 g'ı geçmesin (yüksek kilolarda rakamların şişmemesi için).
  protein = Math.min(protein, Math.round((kcal * 0.3) / 4), 150);
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = Math.min(4000, Math.max(1500, Math.round((input.weight_kg * 33) / 50) * 50));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal_target: kcal,
    protein_target_g: protein,
    carbs_target_g: carbs,
    fat_target_g: fat,
    fiber_target_g: fiberTarget(kcal, input.sex),
    water_target_ml: water,
  };
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type BmiClass = "under" | "normal" | "over" | "obese";
export function bmiClass(value: number): BmiClass {
  if (value < 18.5) return "under";
  if (value < 25) return "normal";
  if (value < 30) return "over";
  return "obese";
}

export function sumNutrients(items: Partial<Nutrients>[]): Nutrients {
  const total: Nutrients = { ...EMPTY_NUTRIENTS };
  for (const it of items) {
    for (const k of NUTRIENT_KEYS) total[k] += Number(it[k]) || 0;
  }
  return total;
}

export function roundNutrients<T extends Nutrients>(n: T): T {
  return {
    ...n,
    kcal: Math.round(n.kcal),
    protein_g: r1(n.protein_g),
    carbs_g: r1(n.carbs_g),
    fat_g: r1(n.fat_g),
    sugar_g: r1(n.sugar_g),
    fiber_g: r1(n.fiber_g),
    salt_g: Math.round(n.salt_g * 100) / 100,
    alcohol_g: r1(n.alcohol_g),
  };
}

export function r1(n: number): number {
  return Math.round((Number(n) || 0) * 10) / 10;
}

/** Gramaj değişince tüm besin değerlerini orantıla. */
export function scaleNutrients<T extends Nutrients>(item: T, factor: number): T {
  if (!isFinite(factor) || factor < 0) return item;
  const out = { ...item };
  for (const k of NUTRIENT_KEYS) out[k] = (Number(item[k]) || 0) * factor;
  return roundNutrients(out);
}

/** Makrolardan enerji (Atwater): 4/4/9 ve alkol 7 kcal/g. */
export function kcalFromMacros(n: Pick<Nutrients, "protein_g" | "carbs_g" | "fat_g" | "alcohol_g">): number {
  return n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9 + (n.alcohol_g || 0) * 7;
}

/** Hedefe ilerleme yüzdesi (başlangıç → hedef kilo). */
export function goalProgress(start: number | null, current: number | null, target: number | null): number | null {
  if (start == null || current == null || target == null) return null;
  const total = target - start;
  if (Math.abs(total) < 0.05) return 100;
  const done = current - start;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export function pct(value: number, target: number | null | undefined): number {
  if (!target || target <= 0) return 0;
  return Math.round((value / target) * 100);
}
