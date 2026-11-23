import { describe, expect, it } from "vitest";
import { dailySum, intensityFor, localDateKey, mapWorkoutType, planSync, sleepHoursByWakeDate, standHoursByDate, stableUuid, type DeviceDay, type Existing } from "@/lib/bkn/health-map";
import type { Activity, DailyLog, HealthRing } from "@/lib/types";

const empty: Existing = { daily: [], rings: [], activities: [], body: [] };
const day = (date: string, o: Partial<DeviceDay> = {}): DeviceDay => ({ date, steps: null, distance_km: null, active_kcal: null, exercise_min: null, stand_hours: null, sleep_hours: null, ...o });

describe("ham veri → günlük değerler", () => {
  it("günlük toplamları yerel güne göre hesaplar", () => {
    const m = dailySum([{ startDate: "2026-11-20T10:00:00", value: 4000 }, { startDate: "2026-11-20T18:30:00", value: 1500 }, { startDate: "2026-11-21T09:00:00", value: 900 }]);
    expect(m.get(localDateKey("2026-11-20T12:00:00"))).toBe(5500);
    expect(m.get(localDateKey("2026-11-21T12:00:00"))).toBe(900);
  });
  it("uyku: uyuyor evrelerini toplar, uyanık/yatakta olmayı saymaz, uyanma gününe yazar", () => {
    const m = sleepHoursByWakeDate([
      { endDate: "2026-11-21T03:00:00", value: 180, sleepState: "light" },
      { endDate: "2026-11-21T04:00:00", value: 60, sleepState: "deep" },
      { endDate: "2026-11-21T04:30:00", value: 30, sleepState: "awake" },
      { endDate: "2026-11-21T06:30:00", value: 120, sleepState: "rem" },
      { endDate: "2026-11-21T07:00:00", value: 480, sleepState: "inBed" },
    ]);
    expect(m.get(localDateKey("2026-11-21T12:00:00"))).toBe(6.0);
  });
  it("ayakta saatleri: ayakta kalınan her saat bir sayılır", () => {
    const m = standHoursByDate([
      { startDate: "2026-11-21T08:00:00", value: 1, standState: "stood" },
      { startDate: "2026-11-21T09:00:00", value: 1, standState: "stood" },
      { startDate: "2026-11-21T10:00:00", value: 0, standState: "idle" },
    ]);
    expect(m.get(localDateKey("2026-11-21T12:00:00"))).toBe(2);
  });
  it("antrenman türlerini eşler", () => {
    expect(mapWorkoutType("running")).toBe("running");
    expect(mapWorkoutType("runningTreadmill")).toBe("running");
    expect(mapWorkoutType("traditionalStrengthTraining")).toBe("weights");
    expect(mapWorkoutType("highIntensityIntervalTraining")).toBe("fitness");
    expect(mapWorkoutType("soccer")).toBe("football");
    expect(mapWorkoutType("curling")).toBe("other");
  });
  it("yoğunluk kaloriye göre", () => {
    expect(intensityFor(30, 90)).toBe("low");
    expect(intensityFor(30, 210)).toBe("moderate");
    expect(intensityFor(30, 330)).toBe("high");
    expect(intensityFor(30, null)).toBe("moderate");
  });
  it("kararlı kimlik: aynı girdi aynı UUID, farklı girdi farklı", () => {
    expect(stableUuid("a")).toBe(stableUuid("a"));
    expect(stableUuid("a")).not.toBe(stableUuid("b"));
    expect(stableUuid("workout:xyz")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("eşitleme planı", () => {
  const today = "2026-11-23";
  it("boş günlük kayıt için adım ve uyku yazar", () => {
    const p = planSync({ days: [day("2026-11-22", { steps: 8200.4, sleep_hours: 7.2 })], workouts: [], weights: [], existing: empty, today });
    expect(p.daily).toHaveLength(1);
    expect(p.daily[0]).toMatchObject({ entry_date: "2026-11-22", steps: 8200, sleep_hours: 7.2 });
  });
  it("elle girilen uykuyu ezmez, adımı yalnızca cihaz daha büyükse günceller; ruh halini korur", () => {
    const log = { id: "l1", entry_date: "2026-11-22", steps: 5000, sleep_hours: 6, sleep_quality: 4, mood: 5, energy: 3, stress: 2, note: "iyi" } as DailyLog;
    const p = planSync({ days: [day("2026-11-22", { steps: 9000, sleep_hours: 8 })], workouts: [], weights: [], existing: { ...empty, daily: [log] }, today });
    expect(p.daily[0]).toMatchObject({ id: "l1", steps: 9000, sleep_hours: 6, mood: 5, note: "iyi" });
    const p2 = planSync({ days: [day("2026-11-22", { steps: 4000 })], workouts: [], weights: [], existing: { ...empty, daily: [log] }, today });
    expect(p2.daily).toHaveLength(0);
  });
  it("gelecek günleri yazmaz", () => {
    expect(planSync({ days: [day("2026-11-25", { steps: 100 })], workouts: [], weights: [], existing: empty, today }).daily).toHaveLength(0);
  });
  it("halka: yoksa yazar (varsayılan hedeflerle), cihaz kaynaklıyı günceller, elle girileni ezmez", () => {
    const d = day("2026-11-22", { active_kcal: 480.6, exercise_min: 41, stand_hours: 9, steps: 8000, distance_km: 5.234 });
    const fresh = planSync({ days: [d], workouts: [], weights: [], existing: empty, today });
    expect(fresh.rings[0]).toMatchObject({ move_kcal: 481, exercise_min: 41, stand_hours: 9, move_goal: 600, exercise_goal: 30, stand_goal: 12, source: "device", distance_km: 5.23 });
    const device = { id: "r1", entry_date: "2026-11-22", move_goal: 500, exercise_goal: 30, stand_goal: 12, move_kcal: 100, source: "device" } as HealthRing;
    expect(planSync({ days: [d], workouts: [], weights: [], existing: { ...empty, rings: [device] }, today }).rings[0]).toMatchObject({ id: "r1", move_goal: 500, move_kcal: 481 });
    const manual = { ...device, source: "manual" } as HealthRing;
    expect(planSync({ days: [d], workouts: [], weights: [], existing: { ...empty, rings: [manual] }, today }).rings).toHaveLength(0);
  });
  it("hedefler son bilinen halkadan gelir", () => {
    const last = { id: "r0", entry_date: "2026-11-20", move_goal: 450, exercise_goal: 40, stand_goal: 10, source: "manual" } as HealthRing;
    const p = planSync({ days: [day("2026-11-22", { active_kcal: 300 })], workouts: [], weights: [], existing: { ...empty, rings: [last] }, today });
    expect(p.rings[0]).toMatchObject({ move_goal: 450, exercise_goal: 40, stand_goal: 10 });
  });
  it("antrenman: eşler, kaloriyi alır; elle girilmiş benzer aktiviteyi çiftlemez", () => {
    const w = { key: "w1", type: "running", start: "2026-11-22T07:00:00", end: "2026-11-22T07:30:00", minutes: 30, kcal: 280, distance_km: 4.5, source: "Apple Watch" };
    const p = planSync({ days: [], workouts: [w], weights: [], existing: empty, today });
    expect(p.activities[0]).toMatchObject({ type: "running", duration_min: 30, kcal_burned: 280, distance_km: 4.5, intensity: "high", note: "Cihazdan: Apple Watch" });
    const manual = { id: "a1", entry_date: "2026-11-22", started_at: new Date("2026-11-22T07:05:00").toISOString(), type: "running" } as Activity;
    expect(planSync({ days: [], workouts: [w], weights: [], existing: { ...empty, activities: [manual] }, today }).activities).toHaveLength(0);
    const sameId = planSync({ days: [], workouts: [w], weights: [], existing: empty, today }).activities[0].id;
    expect(sameId).toBe(p.activities[0].id);
  });
  it("kalori yoksa MET ve kiloyla tahmin eder", () => {
    const w = { key: "w2", type: "walking", start: "2026-11-22T18:00:00", end: "2026-11-22T19:00:00", minutes: 60, kcal: null, distance_km: null };
    const a = planSync({ days: [], workouts: [w], weights: [], existing: empty, weightKg: 80, today }).activities[0];
    expect(a.kcal_burned).toBeGreaterThan(100);
    expect(a.kcal_burned).toBeLessThan(300);
  });
  it("kilo: o gün ölçüm yoksa ekler", () => {
    const p = planSync({ days: [], workouts: [], weights: [{ date: "2026-11-22", kg: 64.62 }, { date: "2026-11-22", kg: 64.5 }], existing: empty, today });
    expect(p.body).toHaveLength(1);
    expect(p.body[0].weight_kg).toBe(64.6);
    const q = planSync({ days: [], workouts: [], weights: [{ date: "2026-11-22", kg: 64 }], existing: { ...empty, body: [{ id: "b", entry_date: "2026-11-22" } as never] }, today });
    expect(q.body).toHaveLength(0);
  });
});
