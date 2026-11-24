import { scaleNutrients } from "./calc";
import { scaleMicros } from "./micros";
import type { FoodItem } from "@/lib/types";

export const NUTRIENT_FIELDS = ["kcal", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "salt_g", "alcohol_g"] as const;

/** Besin alanlarının parmak izi: kullanıcı değerleri elle değiştirdi mi anlamak için. */
export function nutrientSig(i: Pick<FoodItem, (typeof NUTRIENT_FIELDS)[number]>): string {
  return NUTRIENT_FIELDS.map((k) => i[k]).join("|");
}

export interface RegramBase {
  /** Referans gramaj ve o gramaja ait besin değerleri (hiç ölçeklenmemiş). */
  grams: number;
  item: FoodItem;
  /** Son ölçekleme sonucunun parmak izi; kullanıcı elle değiştirirse eşleşmez ve referans yenilenir. */
  emitted: string;
}

/**
 * Gramaj `g` olduğunda besin değerleri: HER ZAMAN referans değerden orantılanır (tuş vuruşlarında yuvarlama birikmez).
 * Referans yoksa (gramaj bilinmiyor ya da kalori 0) ölçekleme yapılmaz; yalnızca gramaj değişir.
 */
export function regram(item: FoodItem, g: number, base: RegramBase | null): { patch: Partial<FoodItem>; base: RegramBase | null } {
  let b = base;
  if (!b || b.emitted !== nutrientSig(item)) b = item.grams && item.grams > 0 ? { grams: item.grams, item: { ...item }, emitted: nutrientSig(item) } : null;
  if (!b || !(b.item.kcal > 0)) {
    const keep = item.grams && item.grams > 0 ? b : { grams: g, item: { ...item, grams: g }, emitted: nutrientSig(item) };
    return { patch: { grams: g }, base: keep };
  }
  const f = g / b.grams;
  const scaled = scaleNutrients(b.item, f);
  const patch: Partial<FoodItem> = { grams: g, micros: scaleMicros(b.item.micros, f) };
  for (const k of NUTRIENT_FIELDS) patch[k] = scaled[k];
  return { patch, base: { ...b, emitted: nutrientSig({ ...item, ...patch } as FoodItem) } };
}
