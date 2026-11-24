import { describe, expect, it } from "vitest";
import { regram, type RegramBase } from "@/lib/nutrition/regram";
import type { FoodItem } from "@/lib/types";

const item = (over: Partial<FoodItem> = {}): FoodItem => ({ name: "Yoğurt", quantity: 100, unit: "g", grams: 100, kcal: 61, protein_g: 4, carbs_g: 4.7, fat_g: 3.3, sugar_g: 4.7, fiber_g: 0, salt_g: 0.1, alcohol_g: 0, confidence: 1, is_estimated: false, data_source: "reference", ...over });

/** Kullanıcının gramajı tuş tuş yazmasını taklit eder. */
function type(start: FoodItem, values: (number | null)[]) {
  let cur = start;
  let base: RegramBase | null = null;
  for (const v of values) {
    if (v == null || v <= 0) {
      cur = { ...cur, grams: v };
      continue;
    }
    const r = regram(cur, v, base);
    base = r.base;
    cur = { ...cur, ...r.patch };
  }
  return cur;
}

describe("regram", () => {
  it("100 g → 200 g: protein 4 → 8", () => {
    const r = regram(item(), 200, null);
    expect(r.patch.protein_g).toBe(8);
    expect(r.patch.kcal).toBe(122);
  });
  it("tuş tuş yazmak ('2', '20', '200') doğrudan 200 ile aynı sonucu verir", () => {
    const direct = type(item(), [200]);
    const typed = type(item(), [2, 20, 200]);
    expect(typed.protein_g).toBe(direct.protein_g);
    expect(typed.kcal).toBe(direct.kcal);
  });
  it("alanı silip yeniden yazınca bozulmaz", () => {
    const typed = type(item(), [10, 1, null, 2, 20, 200]);
    expect(typed.protein_g).toBe(8);
    expect(typed.kcal).toBe(122);
  });
  it("kullanıcı protein değerini elle değiştirirse yeni değer referans olur", () => {
    let cur = type(item(), [200]);
    cur = { ...cur, protein_g: 10 };
    const r = regram(cur, 100, null);
    expect(r.patch.protein_g).toBe(5);
  });
  it("gramaj bilinmiyorsa ölçeklemez", () => {
    const r = regram(item({ grams: null }), 150, null);
    expect(r.patch.protein_g).toBeUndefined();
    expect(r.patch.grams).toBe(150);
  });
});
