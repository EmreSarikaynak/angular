import { describe, expect, it } from "vitest";
import { computeStreaks } from "@/lib/bkn/streaks";
import { elapsedHours, fastingProgress, fastingStats, hm, stockDaysLeft, LOW_STOCK_DAYS } from "@/lib/bkn/fasting";
import { eveningNotice, stockNotice } from "@/lib/bkn/messages";
import { caffeineMg, CAFFEINE_DAILY_LIMIT_MG } from "@/lib/nutrition/drinks";
import { dayRows } from "@/lib/stats";
import { addDays } from "@/lib/dates";
import type { FastingSession, FoodEntry, Profile, WaterLog } from "@/lib/types";

const profile = { kcal_target: 2000, protein_target_g: 100, water_target_ml: 2000, steps_target: 8000, weight_kg: 78, start_weight_kg: 80, goal: "lose", add_exercise_calories: false } as Profile;
const end = "2026-06-30";
const food = (date: string, protein = 100) => ({ id: date + Math.random(), entry_date: date, meal: "lunch", name: "x", kcal: 2000, protein_g: protein, carbs_g: 200, fat_g: 60, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0 }) as FoodEntry;
const water = (date: string, ml = 2000) => ({ id: date, entry_date: date, logged_at: "", amount_ml: ml }) as WaterLog;
const rows = (foods: FoodEntry[], waters: WaterLog[] = []) => dayRows(addDays(end, -29), end, { food: foods, water: waters, activities: [], daily: [] }, profile);
const none = { activityCount: 0, supplementPerfectDays: 0, totalEntries: 0 };

describe("seriler ve rozetler", () => {
  it("bugün kayıt varsa seri bugünü de sayar", () => {
    const s = computeStreaks(rows([0, 1, 2, 3].map((i) => food(addDays(end, -i)))), profile, none);
    expect(s.current).toBe(4);
    expect(s.longest).toBe(4);
  });
  it("bugün henüz kayıt yoksa seri bozulmaz (dünden sayılır)", () => {
    expect(computeStreaks(rows([1, 2, 3].map((i) => food(addDays(end, -i)))), profile, none).current).toBe(3);
  });
  it("bir gün atlanırsa seri sıfırlanır, en uzun seri korunur", () => {
    const s = computeStreaks(rows([0, 2, 3, 4, 5, 6, 7, 8].map((i) => food(addDays(end, -i)))), profile, none);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(7);
    expect(s.badges.find((b) => b.key === "streak_7")!.earned).toBe(true);
    expect(s.badges.find((b) => b.key === "streak_30")).toMatchObject({ earned: false });
  });
  it("hiç kayıt yoksa seri 0 ve rozet yok", () => {
    const s = computeStreaks(rows([]), profile, none);
    expect(s.current).toBe(0);
    expect(s.badges.filter((b) => b.earned).map((b) => b.key)).toEqual(["weight_first_kg"]);
  });
  it("su, protein ve sayaç rozetleri", () => {
    const days = [0, 1, 2, 3, 4, 5, 6];
    const s = computeStreaks(rows(days.map((i) => food(addDays(end, -i), i < 3 ? 100 : 20)), days.map((i) => water(addDays(end, -i)))), profile, { activityCount: 10, supplementPerfectDays: 3, totalEntries: 99 });
    const b = Object.fromEntries(s.badges.map((x) => [x.key, x]));
    expect(s.waterCurrent).toBe(7);
    expect(b.water_7.earned).toBe(true);
    expect(b.protein_7).toMatchObject({ earned: false });
    expect(b.protein_7.progress).toBeCloseTo(3 / 7);
    expect(b.active_10.earned).toBe(true);
    expect(b.supplements_7.earned).toBe(false);
    expect(b.logs_100).toMatchObject({ earned: false, progress: 0.99 });
  });
  it("kilo rozeti hedef yönüne göre", () => {
    expect(computeStreaks(rows([]), { ...profile, weight_kg: 81 } as Profile, none).badges.find((b) => b.key === "weight_first_kg")!.earned).toBe(false);
    expect(computeStreaks(rows([]), { ...profile, goal: "gain", weight_kg: 81.5 } as Profile, none).badges.find((b) => b.key === "weight_first_kg")!.earned).toBe(true);
  });
});

describe("aralıklı oruç", () => {
  const start = "2026-06-29T20:00:00.000Z";
  const at = (h: number) => new Date(start).getTime() + h * 3_600_000;
  const s = { started_at: start, ended_at: null, target_hours: 16 };
  it("geçen ve kalan süre", () => {
    const p = fastingProgress(s, at(10));
    expect(p).toMatchObject({ hours: 10, remaining: 6, done: false });
    expect(p.ratio).toBeCloseTo(0.625);
    expect(p.endsAt.toISOString()).toBe("2026-06-30T12:00:00.000Z");
    expect(fastingProgress(s, at(17))).toMatchObject({ remaining: 0, ratio: 1, done: true });
  });
  it("biten oruçta bitiş zamanı esas alınır", () => {
    expect(elapsedHours({ started_at: start, ended_at: "2026-06-30T10:30:00.000Z" }, at(40))).toBe(14.5);
  });
  it("saat/dakika biçimi ve istatistik", () => {
    expect(hm(13.09)).toEqual({ h: 13, m: 5 });
    expect(hm(15.999)).toEqual({ h: 16, m: 0 });
    const list = [{ ...s, id: "1", ended_at: "2026-06-30T12:00:00.000Z" }, { ...s, id: "2", ended_at: "2026-06-30T08:00:00.000Z" }, { ...s, id: "3" }] as FastingSession[];
    expect(fastingStats(list)).toEqual({ completed: 2, reached: 1, average: 14, longest: 16 });
    expect(fastingStats([])).toMatchObject({ completed: 0, average: 0 });
  });
});

describe("takviye stoku ve kafein", () => {
  it("kalan gün = stok / (doz adedi × günlük alım)", () => {
    expect(stockDaysLeft({ stock_count: 30, per_dose: 1, times: ["09:00"], active: true })).toBe(30);
    expect(stockDaysLeft({ stock_count: 20, per_dose: 2, times: ["09:00", "21:00"], active: true })).toBe(5);
    expect(stockDaysLeft({ stock_count: null, times: ["09:00"], active: true })).toBeNull();
    expect(stockDaysLeft({ stock_count: 0, times: ["09:00"], active: true })).toBe(0);
    expect(LOW_STOCK_DAYS).toBe(5);
  });
  it("kafein içecek türü ve hacme göre", () => {
    expect(caffeineMg("coffee", 200)).toBe(80);
    expect(caffeineMg("turkish_coffee", 70)).toBe(63);
    expect(caffeineMg("tea", 100)).toBe(20);
    expect(caffeineMg("energy", 250)).toBe(80);
    expect(caffeineMg("juice", 500)).toBe(0);
    expect(caffeineMg("beer", 500)).toBe(0);
    expect(CAFFEINE_DAILY_LIMIT_MG).toBe(400);
  });
});

describe("akşam ve stok bildirimi", () => {
  it("günün özeti gerçek değerleri taşır", () => {
    const n = eveningNotice("tr", { meals: 3, waterMl: 1500, waterTarget: 2000, proteinG: 80, proteinTarget: 100, supplementsLeft: 1 });
    expect(n.title).toContain("Bugün kendin için ne yaptın?");
    expect(n.body).toContain("3 öğün");
    expect(n.body).toContain("1500/2000");
    expect(n.body).toContain("80/100");
    expect(n.body).toContain("1 takviye");
    expect(eveningNotice("en", { meals: 2, waterMl: 500, waterTarget: 2000, proteinG: 0, proteinTarget: 0, supplementsLeft: 0 }).body).not.toMatch(/protein|supplement/);
  });
  it("kayıt yoksa suçlayıcı olmayan bir davet", () => {
    expect(eveningNotice("tr", { meals: 0, waterMl: 0, waterTarget: 2000, proteinG: 0, proteinTarget: 100, supplementsLeft: 0 }).body).toContain("henüz kayıt yok");
  });
  it("stok bildirimi", () => {
    expect(stockNotice("tr", "Omega 3", 4)).toMatchObject({ url: "/supplements" });
    expect(stockNotice("en", "Omega 3", 4).body).toContain("4 day");
  });
});
