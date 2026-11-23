import type { Lang } from "../types";

type L = Record<string, { tr: string; en: string }>;

export const MEAL_LABELS: L = {
  breakfast: { tr: "Kahvaltı", en: "Breakfast" },
  lunch: { tr: "Öğle yemeği", en: "Lunch" },
  dinner: { tr: "Akşam yemeği", en: "Dinner" },
  snack: { tr: "Ara öğün", en: "Snack" },
  night: { tr: "Gece atıştırması", en: "Late-night snack" },
  drink: { tr: "İçecekler", en: "Drinks" },
};

export const ACTIVITY_LABELS: L = {
  walking: { tr: "Yürüyüş", en: "Walking" },
  running: { tr: "Koşu", en: "Running" },
  pilates: { tr: "Pilates", en: "Pilates" },
  fitness: { tr: "Fitness", en: "Fitness" },
  cycling: { tr: "Bisiklet", en: "Cycling" },
  swimming: { tr: "Yüzme", en: "Swimming" },
  yoga: { tr: "Yoga", en: "Yoga" },
  weights: { tr: "Ağırlık antrenmanı", en: "Weight training" },
  football: { tr: "Futbol", en: "Football" },
  housework: { tr: "Ev işleri", en: "Housework" },
  other: { tr: "Diğer", en: "Other" },
};

export const DRINK_LABELS: L = {
  beer: { tr: "Bira", en: "Beer" },
  wine_red: { tr: "Kırmızı şarap", en: "Red wine" },
  wine_white: { tr: "Beyaz şarap", en: "White wine" },
  whisky: { tr: "Viski", en: "Whisky" },
  raki: { tr: "Rakı", en: "Raki" },
  vodka: { tr: "Votka", en: "Vodka" },
  gin: { tr: "Cin", en: "Gin" },
  cocktail: { tr: "Kokteyl", en: "Cocktail" },
  coffee: { tr: "Kahve (sade)", en: "Coffee (black)" },
  turkish_coffee: { tr: "Türk kahvesi", en: "Turkish coffee" },
  latte: { tr: "Sütlü kahve / latte", en: "Latte" },
  tea: { tr: "Çay", en: "Tea" },
  juice: { tr: "Meyve suyu", en: "Fruit juice" },
  soda: { tr: "Gazlı içecek", en: "Soft drink" },
  soda_zero: { tr: "Gazlı içecek (şekersiz)", en: "Soft drink (zero)" },
  ayran: { tr: "Ayran", en: "Ayran" },
  milk: { tr: "Süt", en: "Milk" },
  energy: { tr: "Enerji içeceği", en: "Energy drink" },
  other: { tr: "Diğer içecek", en: "Other drink" },
};

export const ACTIVITY_LEVEL_LABELS: L = {
  sedentary: { tr: "Hareketsiz (masa başı, spor yok)", en: "Sedentary (desk job, no exercise)" },
  light: { tr: "Az hareketli (haftada 1–3 gün hafif egzersiz)", en: "Lightly active (light exercise 1–3 days/week)" },
  moderate: { tr: "Orta (haftada 3–5 gün egzersiz)", en: "Moderately active (exercise 3–5 days/week)" },
  active: { tr: "Hareketli (haftada 6–7 gün egzersiz)", en: "Very active (exercise 6–7 days/week)" },
  very_active: { tr: "Çok hareketli (ağır iş veya günde çift antrenman)", en: "Extra active (physical job or training twice a day)" },
};

export const GOAL_LABELS: L = {
  lose: { tr: "Kilo vermek", en: "Lose weight" },
  maintain: { tr: "Kilomu korumak", en: "Maintain weight" },
  gain: { tr: "Kilo almak", en: "Gain weight" },
};

export const INTENSITY_LABELS: L = {
  low: { tr: "Düşük", en: "Low" },
  moderate: { tr: "Orta", en: "Moderate" },
  high: { tr: "Yüksek", en: "High" },
};

export const ALLERGY_OPTIONS: L = {
  gluten: { tr: "Gluten", en: "Gluten" },
  lactose: { tr: "Süt / laktoz", en: "Milk / lactose" },
  egg: { tr: "Yumurta", en: "Egg" },
  peanut: { tr: "Yer fıstığı", en: "Peanut" },
  tree_nuts: { tr: "Kuruyemiş", en: "Tree nuts" },
  fish: { tr: "Balık", en: "Fish" },
  shellfish: { tr: "Kabuklu deniz ürünleri", en: "Shellfish" },
  soy: { tr: "Soya", en: "Soy" },
  sesame: { tr: "Susam", en: "Sesame" },
};

export const DIET_OPTIONS: L = {
  vegetarian: { tr: "Vejetaryen", en: "Vegetarian" },
  vegan: { tr: "Vegan", en: "Vegan" },
  pescatarian: { tr: "Pesketaryen", en: "Pescatarian" },
  halal: { tr: "Helal", en: "Halal" },
  low_carb: { tr: "Düşük karbonhidrat", en: "Low carb" },
  high_protein: { tr: "Yüksek protein", en: "High protein" },
  mediterranean: { tr: "Akdeniz tipi", en: "Mediterranean" },
  gluten_free: { tr: "Glutensiz", en: "Gluten free" },
  low_sugar: { tr: "Az şekerli", en: "Low sugar" },
};

export function label(map: L, key: string | null | undefined, lang: Lang): string {
  if (!key) return "";
  return map[key]?.[lang] ?? key;
}
