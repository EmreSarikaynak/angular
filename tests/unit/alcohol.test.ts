import { describe, expect, it } from "vitest";
import { drinkKcal, mentionsAlcohol } from "@/lib/bkn/alcohol";
import { suggestable } from "@/lib/bkn/pantry";
import { sanitizeServing } from "@/lib/ai/nutrition-sanity";

describe("alkol tespiti", () => {
  it("alkollü adları yakalar", () => {
    for (const s of ["Efes Pilsen bira", "kırmızı şarap", "Yeni Rakı", "vodka", "Tavuk şarap soslu", "white wine", "Whisky", "Cin tonik", "rakı sofrası"]) expect(mentionsAlcohol(s)).toBe(true);
  });
  it("alkolsüzleri ve yiyecekleri yakalamaz", () => {
    for (const s of ["Alkolsüz bira", "non-alcoholic beer", "yoğurt", "ayran", "Kokteyl sosis", "Mimoza salata", "domates", "ciğer"]) expect(mentionsAlcohol(s)).toBe(false);
  });
  it("alkollü ve takviye ürünler öneride kullanılamaz", () => {
    expect(suggestable({ name: "Bira", category: "alcohol" })).toBe(false);
    expect(suggestable({ name: "D vitamini", category: "supplement" })).toBe(false);
    expect(suggestable({ name: "Şarap", category: "food" })).toBe(false);
    expect(suggestable({ name: "Süt", category: "drink" })).toBe(true);
    expect(suggestable({ name: "Yumurta" })).toBe(true);
  });
});

describe("içecek kalorisi", () => {
  it("alkol enerjisi (7 kcal/g) modelin tahmini düşük olsa da atlanmaz", () => {
    // 500 ml %5 bira ≈ 19.7 g alkol ≈ 138 kcal
    expect(drinkKcal(500, 5, 20)).toBe(138);
    expect(drinkKcal(500, 5, 220)).toBe(220);
    expect(drinkKcal(null, null, 140)).toBe(140);
    expect(drinkKcal(null, null, null)).toBeNull();
  });
});

describe("tarif değeri denetimi", () => {
  it("uçuk değerleri sınırlar ve kaloriyi makrolardan düzeltir", () => {
    const r = sanitizeServing({ kcal: 300, protein_g: 400, carbs_g: 30, fat_g: 10 });
    expect(r.protein_g).toBe(70);
    expect(r.kcal).toBe(70 * 4 + 30 * 4 + 10 * 9);
  });
  it("tutarlı değerleri değiştirmez", () => {
    expect(sanitizeServing({ kcal: 420, protein_g: 35, carbs_g: 40, fat_g: 13 })).toEqual({ kcal: 420, protein_g: 35, carbs_g: 40, fat_g: 13 });
  });
});
