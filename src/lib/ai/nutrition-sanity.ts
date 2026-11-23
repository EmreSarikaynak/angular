import { kcalFromMacros } from "../nutrition/calc";

interface RecipeNutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Bir porsiyon için makul üst sınırlar; yapay zekâ çıktısındaki uçuk değerleri yakalar. */
export const SERVING_LIMITS = { kcal: 1400, protein_g: 70, carbs_g: 180, fat_g: 90 } as const;

/**
 * Yapay zekâ tarif değerlerini denetler: makrolar sınırlandırılır ve kalori, makrolardan (4/4/9)
 * %15'ten fazla sapıyorsa makrolardan yeniden hesaplanır. Böylece tutarsız ya da çok büyük rakamlar gösterilmez.
 */
export function sanitizeServing<T extends RecipeNutrients>(r: T): T {
  const protein_g = Math.min(r.protein_g, SERVING_LIMITS.protein_g);
  const carbs_g = Math.min(r.carbs_g, SERVING_LIMITS.carbs_g);
  const fat_g = Math.min(r.fat_g, SERVING_LIMITS.fat_g);
  const fromMacros = Math.round(kcalFromMacros({ protein_g, carbs_g, fat_g, alcohol_g: 0 }));
  const off = r.kcal > 0 && fromMacros > 0 ? Math.abs(r.kcal - fromMacros) / fromMacros : 1;
  const kcal = Math.min(SERVING_LIMITS.kcal, off > 0.15 ? fromMacros : r.kcal);
  return { ...r, kcal, protein_g, carbs_g, fat_g };
}
