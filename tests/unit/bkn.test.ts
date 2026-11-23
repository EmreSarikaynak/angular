import { describe, expect, it } from "vitest";
import { proteinGap, trendInsights } from "@/lib/bkn/insights";
import { RECIPES, pickRecipes } from "@/lib/bkn/recipes";
import { bknDay, supplementSlots } from "@/lib/bkn/score";
import { performanceSummaries, PERF_PERIODS } from "@/lib/bkn/performance";
import { insightNotice, proteinNotice, supplementNotice, waterNotice } from "@/lib/bkn/messages";
import { summarizeDay } from "@/lib/day";
import { dayRows } from "@/lib/stats";
import { addDays } from "@/lib/dates";
import type { DailyLog, FoodEntry, HealthRing, Profile, Supplement, SupplementLog, WaterLog } from "@/lib/types";

const profile = { kcal_target: 2000, protein_target_g: 100, fat_target_g: 60, water_target_ml: 2000, steps_target: 8000, weight_kg: 70, add_exercise_calories: false } as Profile;
const food = (date: string, o: Partial<FoodEntry> = {}) => ({ id: `${date}${Math.random()}`, entry_date: date, meal: "lunch", name: "Yemek", kcal: 2000, protein_g: 100, carbs_g: 200, fat_g: 60, sugar_g: 30, fiber_g: 25, salt_g: 3, alcohol_g: 0, ...o }) as FoodEntry;
const rowsFor = (f: FoodEntry[], extra: { water?: WaterLog[]; daily?: DailyLog[]; rings?: HealthRing[] } = {}) => dayRows("2026-03-01", "2026-03-03", { food: f, water: extra.water ?? [], activities: [], daily: extra.daily ?? [], rings: extra.rings ?? [] }, profile);

describe("eğilim uyarıları", () => {
  it("hedefte giden kullanıcıya uyarı üretmez", () => {
    expect(trendInsights(rowsFor([food("2026-03-01"), food("2026-03-02"), food("2026-03-03")]), profile)).toEqual([]);
  });
  it("tek günlük sapma uyarı üretmez (en az 2 kayıtlı gün)", () => {
    expect(trendInsights(rowsFor([food("2026-03-01", { protein_g: 10, kcal: 3500 })]), profile)).toEqual([]);
  });
  it("düşük protein ve yüksek kalori/şeker/tuz doğru yönle ve tarif etiketiyle bulunur", () => {
    const bad = { protein_g: 50, kcal: 2600, sugar_g: 95, salt_g: 8, fat_g: 100, fiber_g: 8 };
    const list = trendInsights(rowsFor([food("2026-03-01", bad), food("2026-03-02", bad)]), profile);
    const by = Object.fromEntries(list.map((i) => [i.key, i]));
    expect(by.protein_low).toMatchObject({ direction: "under", value: 50, target: 100, recipeTag: "high_protein", days: 2 });
    expect(by.kcal_high).toMatchObject({ direction: "over", recipeTag: "low_cal" });
    expect(by.sugar_high.recipeTag).toBe("low_sugar");
    expect(by.salt_high.recipeTag).toBe("low_salt");
    expect(by.fat_high.recipeTag).toBe("low_fat");
    expect(by.fiber_low.recipeTag).toBe("high_fiber");
    expect(by.kcal_low).toBeUndefined();
  });
  it("su: hiç su kaydı olmayana uyarı yok; az içene var", () => {
    const f = [food("2026-03-01"), food("2026-03-02")];
    expect(trendInsights(rowsFor(f), profile).some((i) => i.key === "water_low")).toBe(false);
    const water = [{ id: "w", entry_date: "2026-03-02", logged_at: "", amount_ml: 600 }] as WaterLog[];
    expect(trendInsights(rowsFor(f, { water }), profile).find((i) => i.key === "water_low")).toMatchObject({ value: 200, target: 2000 });
  });
  it("uyku ve adım yalnızca kayıt varsa değerlendirilir", () => {
    const daily = [{ id: "1", entry_date: "2026-03-01", steps: 2000, sleep_hours: 5 }, { id: "2", entry_date: "2026-03-02", steps: 3000, sleep_hours: 6 }] as DailyLog[];
    const keys = trendInsights(rowsFor([], { daily }), profile).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["steps_low", "sleep_low"]));
  });
  it("protein açığı günün saatine göre değerlendirilir", () => {
    expect(proteinGap(20, 100, 9)).toEqual({ remaining: 80, behind: false });
    expect(proteinGap(20, 100, 15)).toEqual({ remaining: 80, behind: true });
    expect(proteinGap(75, 100, 19)).toEqual({ remaining: 25, behind: false });
    expect(proteinGap(100, 100, 22)).toEqual({ remaining: 0, behind: false });
    expect(proteinGap(10, null, 20).behind).toBe(false);
  });
});

describe("tarifler", () => {
  it("besin değerleri tutarlı ve iki dilde eksiksiz", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      const atwater = r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9;
      expect(Math.abs(atwater - r.kcal) / r.kcal, r.id).toBeLessThan(0.15);
      expect(r.ingredients.tr.length, r.id).toBe(r.ingredients.en.length);
      expect(r.name.en && r.steps.en && r.steps.tr, r.id).toBeTruthy();
      if (r.vegan) expect(r.vegetarian, r.id).toBe(true);
    }
  });
  it("alerji ve beslenme tercihine aykırı tarif önerilmez", () => {
    for (const r of pickRecipes("high_protein", { allergies: ["egg", "lactose", "fish"], limit: 10 })) expect(r.allergens).not.toEqual(expect.arrayContaining(["egg"]));
    expect(pickRecipes("high_protein", { allergies: ["egg", "lactose", "fish"], limit: 10 }).every((r) => !r.allergens.some((a) => ["egg", "lactose", "fish"].includes(a)))).toBe(true);
    expect(pickRecipes("high_protein", { diets: ["vegan"], limit: 10 }).every((r) => r.vegan)).toBe(true);
    expect(pickRecipes("high_fiber", { diets: ["vegetarian", "gluten_free"], limit: 10 }).every((r) => r.vegetarian && !r.allergens.includes("gluten"))).toBe(true);
  });
  it("kalan kaloriye sığanlar tercih edilir, protein yoğunluğuna göre sıralanır", () => {
    const list = pickRecipes("high_protein", { maxKcal: 300, limit: 5 });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.kcal <= 300)).toBe(true);
    expect(list[0].protein_g / list[0].kcal).toBeGreaterThanOrEqual(list.at(-1)!.protein_g / list.at(-1)!.kcal);
  });
});

describe("BKN skoru ve takviyeler", () => {
  const supps = [{ id: "s1", name: "D vitamini", dose: "1000 IU", times: ["21:00", "09:00"], active: true }, { id: "s2", name: "Pasif", dose: null, times: ["10:00"], active: false }] as Supplement[];
  const logs = [{ id: "l1", supplement_id: "s1", entry_date: "2026-03-01", time_slot: "09:00", taken_at: "" }] as SupplementLog[];
  it("günün dozları saat sırasıyla, pasifler hariç", () => {
    const slots = supplementSlots(supps, logs, "2026-03-01");
    expect(slots.map((s) => [s.time, !!s.log])).toEqual([["09:00", true], ["21:00", false]]);
    expect(supplementSlots(supps, logs, "2026-03-02").every((s) => !s.log)).toBe(true);
  });
  it("skor yalnızca takip edilen alanlardan hesaplanır", () => {
    const s = summarizeDay("2026-03-01", { food: [food("2026-03-01")], water: [{ id: "w", entry_date: "2026-03-01", logged_at: "", amount_ml: 2000 }] as WaterLog[], activities: [], daily: [] }, profile);
    const noSupp = bknDay(s, profile, { mealsLogged: 3 });
    expect(noSupp.items.map((i) => i.key)).toEqual(["meals", "protein", "water", "move"]);
    expect(noSupp.score).toBe(75);
    const withSupp = bknDay(s, profile, { mealsLogged: 3, slots: supplementSlots(supps, logs, "2026-03-01"), exerciseMin: 30 });
    expect(withSupp.items.find((i) => i.key === "supplements")!.progress).toBe(0.5);
    expect(withSupp.score).toBe(90);
  });
});

describe("sağlık halkaları ve çifte sayım", () => {
  it("halka kaydı varsa cihazın kalorisi kullanılır, tahminle toplanmaz", () => {
    const base = { food: [], water: [], activities: [{ id: "a", entry_date: "2026-03-01", type: "running", duration_min: 30, distance_km: 5, kcal_burned: 300 }], daily: [{ id: "d", entry_date: "2026-03-01", steps: 9000 }] } as never;
    const est = summarizeDay("2026-03-01", base, profile);
    expect(est.burned_source).toBe("estimate");
    const withRing = summarizeDay("2026-03-01", { ...(base as object), rings: [{ id: "r", entry_date: "2026-03-01", move_kcal: 520, steps: 9100 }] } as never, profile);
    expect(withRing).toMatchObject({ burned_kcal: 520, burned_source: "rings" });
    expect(withRing.burned_kcal).toBeLessThan(est.burned_kcal + 520);
  });
  it("adım girilmemişse halkadaki adım kullanılır", () => {
    const s = summarizeDay("2026-03-01", { food: [], water: [], activities: [], daily: [], rings: [{ id: "r", entry_date: "2026-03-01", move_kcal: null, steps: 6000 }] } as never, profile);
    expect(s.steps).toBe(6000);
    expect(s.burned_source).toBe("estimate");
  });
});

describe("performans özeti", () => {
  it("beş dönem aynı veri kümesinden hesaplanır", () => {
    const end = "2026-03-31";
    const f = [food(end), food(addDays(end, -1), { protein_g: 40 }), food(addDays(end, -10)), food(addDays(end, -40)), food(addDays(end, -200))];
    const out = performanceSummaries(end, {
      food: f, water: [], activities: [{ id: "a", entry_date: addDays(end, -2), type: "yoga", duration_min: 45, kcal_burned: 100 }] as never, daily: [], rings: [],
      body: [{ id: "b1", entry_date: addDays(end, -25), weight_kg: 72 }, { id: "b2", entry_date: end, weight_kg: 70.5 }] as never,
      supplements: [{ id: "s1", name: "X", dose: null, times: ["09:00"], active: true, created_at: `${addDays(end, -1)}T00:00:00Z` }] as Supplement[],
      supplementLogs: [{ id: "l", supplement_id: "s1", entry_date: end, time_slot: "09:00", taken_at: "" }] as SupplementLog[],
    }, profile);
    expect(out.map((o) => o.key)).toEqual(PERF_PERIODS.map((p) => p.key));
    expect(out.map((o) => o.loggedDays)).toEqual([2, 3, 3, 4, 5]);
    expect(out[0]).toMatchObject({ days: 7, avgProtein: 70, proteinAdherence: 50, activeMinutes: 45, supplementAdherence: 50, weightChange: null });
    expect(out[2].weightChange).toBe(-1.5);
    expect(out[0].bknScore).toBeGreaterThan(0);
    expect(out[4].from).toBe(addDays(end, -364));
  });
  it("kayıt yoksa ortalamalar null, skor null", () => {
    const out = performanceSummaries("2026-03-31", { food: [], water: [], activities: [], daily: [], rings: [], body: [], supplements: [], supplementLogs: [] }, profile);
    expect(out[0]).toMatchObject({ loggedDays: 0, avgKcal: null, bknScore: null, supplementAdherence: null });
  });
});

describe("bildirim mesajları", () => {
  it("değişkenler doldurulur, doğru sayfaya yönlendirir", () => {
    expect(waterNotice("tr", 750, 0)).toMatchObject({ url: "/water" });
    expect(waterNotice("tr", 750, 0).body).toContain("750");
    expect(waterNotice("tr", 750, 0).title).not.toBe(waterNotice("tr", 750, 1).title);
    const first = supplementNotice("tr", "Magnezyum", "200 mg", 0);
    const nag = supplementNotice("tr", "Magnezyum", "200 mg", 1);
    expect(first.body).toContain("Magnezyum (200 mg)");
    expect(nag.title).not.toBe(first.title);
    expect(supplementNotice("en", "Omega 3", null, 2).body).toContain("Omega 3");
    expect(proteinNotice("tr", 40, "Lorlu menemen", 1)).toMatchObject({ url: "/coach" });
    expect(proteinNotice("en", 40, "Menemen", 0).title).toContain("40");
    expect(insightNotice("tr", { key: "sugar_high", value: 95.4, target: 60, days: 3 }).body).toContain("95");
  });
  it("hiçbir mesajda doldurulmamış değişken kalmaz", () => {
    const all = [waterNotice("en", 1, 3), supplementNotice("en", "A", "1", 3), proteinNotice("tr", 1, "x", 0), ...(["protein_low", "kcal_high", "kcal_low", "sugar_high", "salt_high", "fat_high", "fiber_low", "water_low", "steps_low", "sleep_low"] as const).flatMap((key) => [insightNotice("tr", { key, value: 1, target: 2, days: 3 }), insightNotice("en", { key, value: 1, target: 2, days: 3 })])];
    for (const n of all) expect(`${n.title} ${n.body}`).not.toMatch(/[{}]/);
  });
});
