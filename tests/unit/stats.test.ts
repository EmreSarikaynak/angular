import { describe, expect, it } from "vitest";
import { summarizeDay } from "@/lib/day";
import { adherence, dayRows, pearson, periodRange, relations, topFoods } from "@/lib/stats";
import { addDays, ageFrom, dateRange, daysBetween, defaultMeal } from "@/lib/dates";
import { translate } from "@/lib/i18n";
import { extractKeys, enKeys } from "../../scripts/i18n-extract.mjs";
import type { Activity, DailyLog, FoodEntry, Profile, WaterLog } from "@/lib/types";

const food = (date: string, kcal: number, o: Partial<FoodEntry> = {}) => ({ id: Math.random().toString(), entry_date: date, consumed_at: `${date}T12:00:00Z`, meal: "lunch", name: "Yemek", kcal, protein_g: 20, carbs_g: 30, fat_g: 10, sugar_g: 5, fiber_g: 3, salt_g: 1, alcohol_g: 0, ...o }) as FoodEntry;
const profile = { kcal_target: 2000, protein_target_g: 100, water_target_ml: 2000, steps_target: 8000, weight_kg: 70, add_exercise_calories: false } as Profile;

describe("gün özeti", () => {
  const data = {
    food: [food("2026-01-02", 600), food("2026-01-02", 150, { meal: "drink", alcohol_g: 14 })],
    water: [{ id: "w", entry_date: "2026-01-02", logged_at: "", amount_ml: 500 }] as WaterLog[],
    activities: [{ id: "a", entry_date: "2026-01-02", type: "walking", duration_min: 40, distance_km: 3, kcal_burned: 120 }] as Activity[],
    daily: [{ id: "d", entry_date: "2026-01-02", steps: 8000 }] as DailyLog[],
  };
  it("içecek kalorisi toplama dahil, alkol suya sayılmaz", () => {
    const s = summarizeDay("2026-01-02", data, profile);
    expect(s.intake.kcal).toBe(750);
    expect(s.water_ml).toBe(500);
    expect(s.remaining_kcal).toBe(1250);
  });
  it("yakılan = aktivite + aktiviteyle çakışmayan adımlar; varsayılan olarak bütçeye eklenmez", () => {
    const s = summarizeDay("2026-01-02", data, profile);
    expect(s.exercise_kcal).toBe(120);
    expect(s.steps_kcal).toBe(102);
    expect(s.budget_kcal).toBe(2000);
    const on = summarizeDay("2026-01-02", data, { ...profile, add_exercise_calories: true });
    expect(on.budget_kcal).toBe(2222);
  });
  it("başka günün kayıtları karışmaz", () => {
    expect(summarizeDay("2026-01-03", data, profile).intake.kcal).toBe(0);
  });
});

describe("istatistik", () => {
  it("hedeflere uyum yalnızca kayıt girilen günlerden hesaplanır", () => {
    const data = { food: [food("2026-01-01", 2000, { protein_g: 95 }), food("2026-01-02", 3000, { protein_g: 40 })], water: [], activities: [], daily: [] };
    const a = adherence(dayRows("2026-01-01", "2026-01-04", data, profile), profile);
    expect(a).toMatchObject({ loggedDays: 2, totalDays: 4, calories: 50, protein: 50, water: null, steps: null });
  });
  it("en sık / en kalorili yiyecekler büyük-küçük harfe duyarsız birleşir", () => {
    const t = topFoods([food("d", 100, { name: "Ayran" }), food("d", 100, { name: "ayran " }), food("d", 900, { name: "Baklava" })]);
    expect(t.byCount[0]).toMatchObject({ name: "Ayran", count: 2 });
    expect(t.byKcal[0].name).toBe("Baklava");
  });
  it("pearson", () => {
    expect(pearson([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]])).toBe(1);
    expect(pearson([[1, 2], [2, 4]])).toBeNull();
    expect(pearson([[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]])).toBeNull();
  });
  it("ilişkiler: yetersiz veride sonuç üretmez", () => {
    const rel = relations(dayRows("2026-01-01", "2026-01-03", { food: [], water: [], activities: [], daily: [] }, profile), []);
    expect(rel.every((r) => r.r === null)).toBe(true);
  });
  it("dönem aralıkları", () => {
    expect(periodRange("week", "2026-01-07")).toEqual({ from: "2026-01-01", to: "2026-01-07" });
    expect(dateRange("2026-01-30", "2026-02-02")).toHaveLength(4);
  });
});

describe("tarih", () => {
  it("gün ekleme ay/yıl sınırını geçer", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
  it("yaş ve varsayılan öğün", () => {
    expect(ageFrom("1990-06-15", new Date(2026, 5, 14))).toBe(35);
    expect(ageFrom("1990-06-15", new Date(2026, 5, 15))).toBe(36);
    expect(defaultMeal(new Date(2026, 0, 1, 8))).toBe("breakfast");
    expect(defaultMeal(new Date(2026, 0, 1, 23))).toBe("night");
  });
});

describe("çeviri", () => {
  it("her arayüz metninin İngilizce karşılığı var", () => {
    const en = enKeys();
    expect(extractKeys().filter((k: string) => !en.has(k))).toEqual([]);
  });
  it("değişkenler yerleştirilir", () => {
    expect(translate("tr", "{n} ml kaldı", { n: 250 })).toBe("250 ml kaldı");
    expect(translate("en", "{n} ml kaldı", { n: 250 })).toContain("250");
  });
});
