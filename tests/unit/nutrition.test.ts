import { describe, expect, it } from "vitest";
import { bmi, bmiClass, bmrMifflin, calculateTargets, goalProgress, kcalFromMacros, scaleNutrients, sumNutrients } from "@/lib/nutrition/calc";
import { activityKcal, activitySteps, metFor, stepsKcal } from "@/lib/nutrition/activities";
import { calcDrink, pureAlcoholGrams, standardDrinks } from "@/lib/nutrition/drinks";
import { REFERENCE_FOODS, nutrientsFromReference, referenceFood } from "@/lib/nutrition/reference-foods";
import { EMPTY_NUTRIENTS } from "@/lib/types";

describe("hedef hesaplama", () => {
  it("Mifflin-St Jeor BMR", () => {
    expect(bmrMifflin("male", 80, 180, 30)).toBe(1780);
    expect(bmrMifflin("female", 60, 165, 30)).toBeCloseTo(1320.25);
  });

  it("kilo verme hedefi açık oluşturur, makrolar enerjiyle tutarlıdır", () => {
    const t = calculateTargets({ sex: "male", age: 30, height_cm: 180, weight_kg: 80, activity_level: "moderate", goal: "lose", weekly_rate_kg: 0.5 });
    expect(t.tdee).toBe(2759);
    expect(t.kcal_target).toBe(2210);
    expect(t.protein_target_g).toBe(128);
    const fromMacros = t.protein_target_g * 4 + t.carbs_target_g * 4 + t.fat_target_g * 9;
    expect(Math.abs(fromMacros - t.kcal_target)).toBeLessThan(10);
    expect(t.water_target_ml).toBe(2650);
  });

  it("güvenlik tabanının altına inmez", () => {
    const t = calculateTargets({ sex: "female", age: 45, height_cm: 155, weight_kg: 50, activity_level: "sedentary", goal: "lose", weekly_rate_kg: 1 });
    expect(t.kcal_target).toBeGreaterThanOrEqual(1200);
  });

  it("koruma = TDEE, kilo alma fazla verir", () => {
    const base = { sex: "female" as const, age: 28, height_cm: 168, weight_kg: 62, activity_level: "light" as const };
    const keep = calculateTargets({ ...base, goal: "maintain" });
    const gain = calculateTargets({ ...base, goal: "gain", weekly_rate_kg: 0.5 });
    expect(Math.abs(keep.kcal_target - keep.tdee)).toBeLessThanOrEqual(3);
    expect(gain.kcal_target).toBeGreaterThan(keep.kcal_target);
  });

  it("VKİ ve ilerleme", () => {
    expect(bmi(80, 180)).toBe(24.7);
    expect(bmiClass(17)).toBe("under");
    expect(bmiClass(27)).toBe("over");
    expect(goalProgress(90, 85, 80)).toBe(50);
    expect(goalProgress(90, 92, 80)).toBe(0);
    expect(goalProgress(null, 85, 80)).toBeNull();
  });

  it("toplama, ölçekleme ve Atwater", () => {
    const a = { ...EMPTY_NUTRIENTS, kcal: 100, protein_g: 10, carbs_g: 5, fat_g: 4 };
    expect(sumNutrients([a, a]).kcal).toBe(200);
    expect(scaleNutrients(a, 1.5)).toMatchObject({ kcal: 150, protein_g: 15, carbs_g: 7.5, fat_g: 6 });
    expect(kcalFromMacros({ protein_g: 10, carbs_g: 10, fat_g: 10, alcohol_g: 10 })).toBe(240);
  });
});

describe("aktivite", () => {
  it("net enerji: dinlenme harcaması çıkarılır", () => {
    expect(activityKcal(3.5, 70, 60)).toBe(175);
    expect(activityKcal(1, 70, 60)).toBe(0);
  });
  it("mesafe verilirse MET hızdan belirlenir", () => {
    expect(metFor("running", "low", 30, 5)).toBe(9.8); // 10 km/sa
    expect(metFor("running", "low", 30, null)).toBe(7.0);
    expect(metFor("yoga", "high", 30, 5)).toBe(4.0);
  });
  it("yürüyüş adımları adım kalorisinden düşülür (çifte sayım yok)", () => {
    const walk = { type: "walking", duration_min: 40, distance_km: 3 };
    expect(activitySteps(walk)).toBe(4050);
    const without = stepsKcal(8000, 70);
    const withWalk = stepsKcal(8000, 70, [walk]);
    expect(withWalk).toBeLessThan(without);
    expect(stepsKcal(3000, 70, [walk])).toBe(0);
    expect(activitySteps({ type: "yoga", duration_min: 60, distance_km: null })).toBe(0);
  });
});

describe("içecek ve alkol", () => {
  it("saf alkol = hacim × ABV × 0,789", () => {
    expect(pureAlcoholGrams(500, 5)).toBe(19.7);
    expect(pureAlcoholGrams(40, 45)).toBe(14.2);
    expect(standardDrinks(19.7)).toBe(2);
  });
  it("bira kalorisi alkol + karbonhidrattan gelir", () => {
    const beer = calcDrink({ type: "beer", volume_ml: 500 });
    expect(beer.alcohol_g).toBe(19.7);
    expect(beer.kcal).toBe(208);
  });
  it("şekersiz çay ~0 kcal, şeker eklenince artar; alkolsüzde alkol 0", () => {
    expect(calcDrink({ type: "tea", volume_ml: 100 }).kcal).toBe(1);
    const sweet = calcDrink({ type: "tea", volume_ml: 100, added_sugar_g: 5 });
    expect(sweet.kcal).toBe(21);
    expect(sweet.sugar_g).toBe(5);
    expect(sweet.alcohol_g).toBe(0);
  });
  it("özel ABV kullanılır", () => {
    expect(calcDrink({ type: "wine_red", volume_ml: 150, abv: 14.5 }).alcohol_g).toBe(17.2);
  });
});

describe("referans besin tablosu", () => {
  it("anahtarlar benzersiz ve değerler tutarlı", () => {
    expect(new Set(REFERENCE_FOODS.map((f) => f.key)).size).toBe(REFERENCE_FOODS.length);
    for (const f of REFERENCE_FOODS) {
      const p = f.per100;
      expect(p.protein_g + p.carbs_g + p.fat_g, f.key).toBeLessThanOrEqual(101);
      expect(p.sugar_g, f.key).toBeLessThanOrEqual(p.carbs_g + 0.01);
      const atwater = p.protein_g * 4 + p.carbs_g * 4 + p.fat_g * 9;
      // Lif ve yuvarlama payıyla, etiket enerjisi makrolardan hesaplananla uyumlu olmalı.
      if (p.kcal > 30) expect(Math.abs(atwater - p.kcal) / p.kcal, f.key).toBeLessThan(0.3);
    }
  });
  it("gramaja göre hesaplar", () => {
    const n = nutrientsFromReference(referenceFood("chicken_breast_grilled")!, 150);
    expect(n).toMatchObject({ kcal: 248, protein_g: 46.5, fat_g: 5.4 });
    expect(referenceFood("yok")).toBeUndefined();
  });
});

describe("protein hedefi makul kalır", () => {
  const base = { sex: "male" as const, age: 35, height_cm: 175, activity_level: "moderate" as const, weekly_rate_kg: 0.5 };
  it("yüksek kilolarda ayarlanmış kilo kullanılır ve 150 g'ı geçmez", () => {
    const t = calculateTargets({ ...base, weight_kg: 150, goal: "lose" });
    expect(t.protein_target_g).toBeLessThanOrEqual(150);
    expect(t.protein_target_g).toBeLessThan(1.6 * 150 * 0.7); // gerçek kiloyla hesaplanandan belirgin düşük
    expect(t.protein_target_g * 4).toBeLessThanOrEqual(t.kcal_target * 0.3 + 4);
  });
  it("korumada 1.2 g/kg, normal kilolarda gerçek kilo", () => {
    expect(calculateTargets({ ...base, weight_kg: 70, goal: "maintain" }).protein_target_g).toBe(84);
  });
  it("hiçbir profilde 150 g'ı aşmaz", () => {
    for (const w of [60, 90, 120, 160, 200]) for (const goal of ["lose", "maintain", "gain"] as const) expect(calculateTargets({ ...base, weight_kg: w, goal }).protein_target_g).toBeLessThanOrEqual(150);
  });
});

import { fiberTarget } from "@/lib/nutrition/calc";
describe("lif hedefi", () => {
  it("1000 kcal başına 14 g, 25–38 g arası (kadınlarda üst sınır 30 g)", () => {
    expect(fiberTarget(1500, "female")).toBe(25);
    expect(fiberTarget(1850, "female")).toBe(26);
    expect(fiberTarget(2800, "female")).toBe(30);
    expect(fiberTarget(2400, "male")).toBe(34);
    expect(fiberTarget(3500, "male")).toBe(38);
  });
  it("hedef hesaplamasına dahildir", () => {
    const t = calculateTargets({ sex: "female", age: 30, height_cm: 168, weight_kg: 64, activity_level: "moderate", goal: "lose", weekly_rate_kg: 0.4 });
    expect(t.fiber_target_g).toBeGreaterThanOrEqual(25);
    expect(t.fiber_target_g).toBeLessThanOrEqual(30);
  });
});
