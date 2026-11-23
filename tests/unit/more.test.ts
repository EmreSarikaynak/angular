import { describe, expect, it } from "vitest";
import { cycleInfo } from "@/lib/bkn/cycle";
import { inEatingWindow, mealLabel, nextRamadanEvent, ramadanDefaultMeal, waterPlan } from "@/lib/bkn/ramadan";
import { challengeEnd, challengeProgress, dayMeets, makeJoinCode } from "@/lib/bkn/challenges";
import { MICRO_DEFS, cleanMicros, microTarget, scaleMicros, sumMicros } from "@/lib/nutrition/micros";
import { postProcessAnalysis } from "@/lib/ai/postprocess";
import { dayRows } from "@/lib/stats";
import type { CycleLog, FoodEntry, Profile, WaterLog } from "@/lib/types";

const log = (start: string, end: string | null = null) => ({ id: start, entry_date: start, end_date: end, note: null }) as CycleLog;

describe("döngü takibi", () => {
  it("kayıt yoksa bilgi üretmez", () => {
    expect(cycleInfo([], "2026-05-10")).toBeNull();
  });
  it("tek kayıtla 28 günlük varsayılan kullanılır", () => {
    const i = cycleInfo([log("2026-05-01", "2026-05-05")], "2026-05-03")!;
    expect(i).toMatchObject({ day: 3, phase: "menstrual", averageLength: 28, basedOn: 0, nextStart: "2026-05-29", daysUntilNext: 26, ongoing: true, premenstrual: false });
  });
  it("ortalama döngü geçmiş başlangıçlardan hesaplanır; olağan dışı aralık hariç", () => {
    const logs = [log("2026-01-01", "2026-01-05"), log("2026-01-31", "2026-02-04"), log("2026-03-02", "2026-03-06"), log("2026-05-30", "2026-06-03")];
    const i = cycleInfo(logs, "2026-06-10")!;
    expect(i.averageLength).toBe(30); // 30, 30; 89 günlük aralık sayılmaz
    expect(i.basedOn).toBe(2);
    expect(i.averagePeriod).toBe(5);
    expect(i.nextStart).toBe("2026-06-29");
  });
  it("evreler ve adet öncesi dönem", () => {
    const logs = [log("2026-04-03", "2026-04-07"), log("2026-05-01", "2026-05-05")];
    expect(cycleInfo(logs, "2026-05-08")!.phase).toBe("follicular");
    expect(cycleInfo(logs, "2026-05-14")!.phase).toBe("ovulation");
    expect(cycleInfo(logs, "2026-05-20")!.phase).toBe("luteal");
    expect(cycleInfo(logs, "2026-05-25")!).toMatchObject({ phase: "luteal", premenstrual: true, daysUntilNext: 4 });
    expect(cycleInfo(logs, "2026-05-10")!.premenstrual).toBe(false);
  });
  it("gecikmede tahmin geçmişte kalmaz; gelecekteki kayıt yok sayılır", () => {
    const i = cycleInfo([log("2026-05-01", "2026-05-05"), log("2026-09-01")], "2026-06-10")!;
    expect(i.nextStart).toBe("2026-06-10");
    expect(i.daysUntilNext).toBe(0);
    expect(i.day).toBe(41);
  });
});

describe("Ramazan modu", () => {
  const m = (h: number, min = 0) => h * 60 + min;
  it("yeme penceresi gece yarısını aşar", () => {
    expect(inEatingWindow(m(19), "19:00", "04:30")).toBe(true);
    expect(inEatingWindow(m(23, 30), "19:00", "04:30")).toBe(true);
    expect(inEatingWindow(m(4, 29), "19:00", "04:30")).toBe(true);
    expect(inEatingWindow(m(4, 30), "19:00", "04:30")).toBe(false);
    expect(inEatingWindow(m(12), "19:00", "04:30")).toBe(false);
    expect(inEatingWindow(m(18, 59), "19:00", "04:30")).toBe(false);
  });
  it("sıradaki olay ve kalan süre", () => {
    expect(nextRamadanEvent(m(17, 30), "19:00", "04:30")).toEqual({ kind: "iftar", minutes: 90 });
    expect(nextRamadanEvent(m(22), "19:00", "04:30")).toEqual({ kind: "sahur", minutes: 390 });
    expect(nextRamadanEvent(m(5), "19:00", "04:30")).toEqual({ kind: "iftar", minutes: 840 });
  });
  it("su planı ve öğün adları", () => {
    expect(waterPlan(2000, "19:00", "04:30")).toEqual({ windowMin: 570, perHourMl: 400 });
    expect(mealLabel("breakfast", "tr", true)).toBe("Sahur");
    expect(mealLabel("dinner", "en", true)).toBe("Iftar");
    expect(mealLabel("breakfast", "tr", false)).toBe("Kahvaltı");
    expect(mealLabel("lunch", "tr", true)).toBe("Öğle yemeği");
  });
  it("saate göre varsayılan öğün", () => {
    expect(ramadanDefaultMeal(m(19, 20), "19:00", "04:30")).toBe("dinner");
    expect(ramadanDefaultMeal(m(23), "19:00", "04:30")).toBe("night");
    expect(ramadanDefaultMeal(m(3, 30), "19:00", "04:30")).toBe("breakfast");
  });
});

describe("meydan okuma", () => {
  const profile = { kcal_target: 2000, protein_target_g: 100, water_target_ml: 2000, steps_target: 8000, weight_kg: 70 } as Profile;
  const food = (d: string, p: number) => ({ id: d, entry_date: d, meal: "lunch", name: "x", kcal: 500, protein_g: p, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0 }) as FoodEntry;
  const rows = dayRows("2026-03-01", "2026-03-04", {
    food: [food("2026-03-01", 95), food("2026-03-02", 40)],
    water: [{ id: "w", entry_date: "2026-03-01", logged_at: "", amount_ml: 2100 }, { id: "w2", entry_date: "2026-03-03", logged_at: "", amount_ml: 900 }] as WaterLog[],
    activities: [], daily: [{ id: "d", entry_date: "2026-03-04", steps: 9000 }] as never,
  }, profile);
  it("ölçüte göre başarılan gün sayısı", () => {
    expect(challengeProgress("logging", rows, profile)).toBe(2);
    expect(challengeProgress("protein", rows, profile)).toBe(1);
    expect(challengeProgress("water", rows, profile)).toBe(1);
    expect(challengeProgress("steps", rows, profile)).toBe(1);
    expect(dayMeets("water", rows[0], { ...profile, water_target_ml: null } as never)).toBe(false);
  });
  it("bitiş tarihi ve katılım kodu", () => {
    expect(challengeEnd("2026-03-01", 7)).toBe("2026-03-07");
    const code = makeJoinCode(new Uint8Array([0, 1, 2, 31, 32, 255, 100, 7, 9]));
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(code).not.toMatch(/[01IO]/);
  });
});

describe("vitamin ve mineraller", () => {
  it("geçersiz ve aşırı değerler ayıklanır", () => {
    expect(cleanMicros({ iron_mg: 2.345, calcium_mg: -5, potassium_mg: 99999, vitamin_c_mg: "12", vitamin_d_mcg: null, x: 5 })).toEqual({ iron_mg: 2.35, vitamin_c_mg: 12 });
    expect(cleanMicros({})).toBeNull();
    expect(cleanMicros(null)).toBeNull();
  });
  it("ölçekleme ve toplama", () => {
    expect(scaleMicros({ iron_mg: 2, calcium_mg: 100 }, 1.5)).toEqual({ iron_mg: 3, calcium_mg: 150 });
    expect(scaleMicros(null, 2)).toBeNull();
    const total = sumMicros([{ iron_mg: 2 }, null, { iron_mg: 1.5, vitamin_c_mg: 30 }]);
    expect(total.iron_mg).toBe(3.5);
    expect(total.vitamin_c_mg).toBe(30);
    expect(total.calcium_mg).toBe(0);
  });
  it("referans değer cinsiyete göre", () => {
    const iron = MICRO_DEFS.find((d) => d.key === "iron_mg")!;
    expect(microTarget(iron, "female")).toBe(18);
    expect(microTarget(iron, "male")).toBe(8);
  });
  it("analiz sonucu mikro besinleri taşır, bozuk değerleri atar", () => {
    const r = postProcessAnalysis({ is_food: true, dish_name: "x", overall_confidence: 0.9, needs_clarification: false, items: [{ name: "Yumurta", ref_key: "egg_boiled", grams: 100, kcal: 155, protein_g: 12, carbs_g: 1, fat_g: 10, sugar_g: 0, fiber_g: 0, salt_g: 0.3, confidence: 0.9, iron_mg: 1.2, calcium_mg: "abc", vitamin_c_mg: -1 }] }, "text", "tr");
    expect(r.items[0].micros).toEqual({ iron_mg: 1.2 });
    const none = postProcessAnalysis({ is_food: true, dish_name: "x", overall_confidence: 0.9, needs_clarification: false, items: [{ name: "Su", grams: 100, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sugar_g: 0, fiber_g: 0, salt_g: 0, confidence: 0.9 }] }, "text", "tr");
    expect(none.items[0].micros).toBeNull();
  });
});
