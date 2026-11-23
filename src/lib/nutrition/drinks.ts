import type { Nutrients } from "../types";
import { EMPTY_NUTRIENTS } from "../types";

export interface DrinkType {
  key: string;
  alcoholic: boolean;
  /** Varsayılan alkol oranı (% hacim). */
  abv: number;
  /** Alkol dışı enerji (kcal/100 ml) — şeker ve diğer karbonhidratlardan. */
  baseKcalPer100: number;
  sugarPer100: number;
  carbsPer100: number;
  proteinPer100?: number;
  fatPer100?: number;
  defaultMl: number;
  servings: number[];
  /** Yaklaşık kafein (mg/100 ml). */
  caffeinePer100?: number;
}

/** Etanol yoğunluğu (g/ml) ve enerji değeri (kcal/g). */
export const ETHANOL_DENSITY = 0.789;
export const ETHANOL_KCAL = 7;
/** Türkiye/DSÖ pratiğinde 1 standart içki ≈ 10 g saf alkol. */
export const STANDARD_DRINK_G = 10;

export const DRINK_TYPES: DrinkType[] = [
  { key: "beer", alcoholic: true, abv: 5, baseKcalPer100: 14, sugarPer100: 0, carbsPer100: 3.6, proteinPer100: 0.5, defaultMl: 330, servings: [330, 500] },
  { key: "wine_red", alcoholic: true, abv: 13, baseKcalPer100: 11, sugarPer100: 0.6, carbsPer100: 2.6, defaultMl: 150, servings: [100, 150, 250] },
  { key: "wine_white", alcoholic: true, abv: 12, baseKcalPer100: 13, sugarPer100: 1.0, carbsPer100: 2.6, defaultMl: 150, servings: [100, 150, 250] },
  { key: "whisky", alcoholic: true, abv: 40, baseKcalPer100: 0, sugarPer100: 0, carbsPer100: 0, defaultMl: 40, servings: [40, 60, 80] },
  { key: "raki", alcoholic: true, abv: 45, baseKcalPer100: 0, sugarPer100: 0, carbsPer100: 0, defaultMl: 40, servings: [40, 70, 100] },
  { key: "vodka", alcoholic: true, abv: 40, baseKcalPer100: 0, sugarPer100: 0, carbsPer100: 0, defaultMl: 40, servings: [40, 60, 80] },
  { key: "gin", alcoholic: true, abv: 40, baseKcalPer100: 0, sugarPer100: 0, carbsPer100: 0, defaultMl: 40, servings: [40, 60] },
  { key: "cocktail", alcoholic: true, abv: 12, baseKcalPer100: 45, sugarPer100: 10, carbsPer100: 11, defaultMl: 200, servings: [150, 200, 300] },
  { key: "coffee", caffeinePer100: 40, alcoholic: false, abv: 0, baseKcalPer100: 1, sugarPer100: 0, carbsPer100: 0, defaultMl: 200, servings: [60, 200, 300] },
  { key: "turkish_coffee", caffeinePer100: 90, alcoholic: false, abv: 0, baseKcalPer100: 3, sugarPer100: 0, carbsPer100: 0.5, defaultMl: 70, servings: [70] },
  { key: "latte", caffeinePer100: 25, alcoholic: false, abv: 0, baseKcalPer100: 45, sugarPer100: 4.5, carbsPer100: 4.5, proteinPer100: 3, fatPer100: 1.7, defaultMl: 300, servings: [240, 300, 400] },
  { key: "tea", caffeinePer100: 20, alcoholic: false, abv: 0, baseKcalPer100: 1, sugarPer100: 0, carbsPer100: 0.2, defaultMl: 100, servings: [100, 200, 330] },
  { key: "juice", alcoholic: false, abv: 0, baseKcalPer100: 46, sugarPer100: 9.5, carbsPer100: 10.8, proteinPer100: 0.5, defaultMl: 200, servings: [200, 250, 330] },
  { key: "soda", caffeinePer100: 9, alcoholic: false, abv: 0, baseKcalPer100: 42, sugarPer100: 10.6, carbsPer100: 10.6, defaultMl: 330, servings: [200, 250, 330, 500] },
  { key: "soda_zero", caffeinePer100: 9, alcoholic: false, abv: 0, baseKcalPer100: 0.3, sugarPer100: 0, carbsPer100: 0, defaultMl: 330, servings: [250, 330, 500] },
  { key: "ayran", alcoholic: false, abv: 0, baseKcalPer100: 37, sugarPer100: 2.6, carbsPer100: 2.6, proteinPer100: 1.9, fatPer100: 1.9, defaultMl: 200, servings: [200, 300] },
  { key: "milk", alcoholic: false, abv: 0, baseKcalPer100: 61, sugarPer100: 4.8, carbsPer100: 4.8, proteinPer100: 3.2, fatPer100: 3.3, defaultMl: 200, servings: [200, 250] },
  { key: "energy", caffeinePer100: 32, alcoholic: false, abv: 0, baseKcalPer100: 45, sugarPer100: 11, carbsPer100: 11, defaultMl: 250, servings: [250, 355, 500] },
  { key: "other", alcoholic: false, abv: 0, baseKcalPer100: 0, sugarPer100: 0, carbsPer100: 0, defaultMl: 200, servings: [200, 330] },
];

export function drinkType(key: string): DrinkType {
  return DRINK_TYPES.find((d) => d.key === key) ?? DRINK_TYPES[DRINK_TYPES.length - 1];
}

/** Saf alkol (gram) = hacim (ml) × ABV × 0.789. */
export function pureAlcoholGrams(volumeMl: number, abvPct: number): number {
  return Math.round(volumeMl * (abvPct / 100) * ETHANOL_DENSITY * 10) / 10;
}

export interface DrinkCalcInput {
  type: string;
  volume_ml: number;
  abv?: number | null;
  /** Eklenen şeker (çay/kahve için küp ≈ 2.5 g). */
  added_sugar_g?: number;
}

export function calcDrink(input: DrinkCalcInput): Nutrients {
  const t = drinkType(input.type);
  const ml = Math.max(0, input.volume_ml);
  const abv = input.abv != null && input.abv >= 0 ? input.abv : t.abv;
  const alcohol = pureAlcoholGrams(ml, abv);
  const f = ml / 100;
  const added = Math.max(0, input.added_sugar_g ?? 0);
  const sugar = t.sugarPer100 * f + added;
  const carbs = t.carbsPer100 * f + added;
  const kcal = alcohol * ETHANOL_KCAL + t.baseKcalPer100 * f + added * 4;
  return {
    ...EMPTY_NUTRIENTS,
    kcal: Math.round(kcal),
    carbs_g: Math.round(carbs * 10) / 10,
    sugar_g: Math.round(sugar * 10) / 10,
    protein_g: Math.round((t.proteinPer100 ?? 0) * f * 10) / 10,
    fat_g: Math.round((t.fatPer100 ?? 0) * f * 10) / 10,
    alcohol_g: alcohol,
  };
}

export function standardDrinks(alcoholG: number): number {
  return Math.round((alcoholG / STANDARD_DRINK_G) * 10) / 10;
}

/** Yetişkinler için genel kabul gören günlük üst sınır (EFSA): 400 mg. */
export const CAFFEINE_DAILY_LIMIT_MG = 400;
/** Bu saatten sonra alınan kafein uykuyu etkileyebilir. */
export const CAFFEINE_LATE_HOUR = 16;

export function caffeineMg(type: string, volumeMl: number): number {
  return Math.round(((drinkType(type).caffeinePer100 ?? 0) * Math.max(0, volumeMl)) / 100);
}
