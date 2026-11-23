import { addDays } from "../dates";
import { adherence, avg, dayRows, type RangeInput } from "../stats";
import type { BodyMeasurement, HealthRing, Profile, Supplement, SupplementLog } from "../types";
import { bknDay, supplementSlots } from "./score";

export type PerfPeriod = "w1" | "w3" | "m1" | "m3" | "y1";
export const PERF_PERIODS: { key: PerfPeriod; days: number }[] = [
  { key: "w1", days: 7 },
  { key: "w3", days: 21 },
  { key: "m1", days: 30 },
  { key: "m3", days: 90 },
  { key: "y1", days: 365 },
];

export interface PerfSummary {
  key: PerfPeriod;
  from: string;
  to: string;
  days: number;
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgWater: number | null;
  avgSteps: number | null;
  avgSleep: number | null;
  activeMinutes: number;
  activitySessions: number;
  burnedKcal: number;
  weightChange: number | null;
  calorieAdherence: number | null;
  proteinAdherence: number | null;
  waterAdherence: number | null;
  supplementAdherence: number | null;
  /** Kayıt girilen günlerin ortalama BKNY skoru (0–100). */
  bknScore: number | null;
}

export interface PerfInput extends RangeInput {
  rings: HealthRing[];
  body: BodyMeasurement[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** Haftalık, 3 haftalık, aylık, 3 aylık ve yıllık performansı aynı veri kümesinden hesaplar. */
export function performanceSummaries(end: string, data: PerfInput, profile: Profile | null): PerfSummary[] {
  return PERF_PERIODS.map(({ key, days }) => {
    const from = addDays(end, -(days - 1));
    const rows = dayRows(from, end, data, profile);
    const logged = rows.filter((r) => r.logged);
    const adh = adherence(rows, profile);
    const watered = rows.filter((r) => r.water_ml > 0);
    const stepped = rows.filter((r) => r.steps > 0);
    const slept = rows.filter((r) => r.daily?.sleep_hours != null);
    const acts = data.activities.filter((a) => a.entry_date >= from && a.entry_date <= end);
    const weights = data.body.filter((b) => b.weight_kg != null && b.entry_date >= from && b.entry_date <= end).sort((a, b) => a.entry_date.localeCompare(b.entry_date));

    // Takviye uyumu: takviyenin eklendiği günden itibaren planlanan dozların alınma oranı.
    let planned = 0;
    let taken = 0;
    for (const r of rows) {
      const active = data.supplements.filter((s) => s.active && (!s.created_at || s.created_at.slice(0, 10) <= r.date));
      const slots = supplementSlots(active, data.supplementLogs, r.date);
      planned += slots.length;
      taken += slots.filter((x) => x.log).length;
    }

    const scores = rows
      .filter((r) => r.logged || r.water_ml > 0 || r.burned_kcal > 0)
      .map((r) => {
        const active = data.supplements.filter((s) => s.active && (!s.created_at || s.created_at.slice(0, 10) <= r.date));
        const meals = new Set(data.food.filter((f) => f.entry_date === r.date && f.meal !== "drink").map((f) => f.meal)).size;
        const exerciseMin = data.activities.filter((a) => a.entry_date === r.date).reduce((s, a) => s + a.duration_min, 0);
        return bknDay(r, profile, { mealsLogged: meals, daily: r.daily, slots: supplementSlots(active, data.supplementLogs, r.date), exerciseMin }).score;
      });

    return {
      key,
      from,
      to: end,
      days,
      loggedDays: logged.length,
      avgKcal: logged.length ? round(avg(logged.map((r) => r.intake.kcal))) : null,
      avgProtein: logged.length ? round(avg(logged.map((r) => r.intake.protein_g))) : null,
      avgWater: watered.length ? round(avg(watered.map((r) => r.water_ml))) : null,
      avgSteps: stepped.length ? round(avg(stepped.map((r) => r.steps))) : null,
      avgSleep: slept.length ? round(avg(slept.map((r) => r.daily!.sleep_hours!)), 1) : null,
      activeMinutes: round(acts.reduce((s, a) => s + a.duration_min, 0)),
      activitySessions: acts.length,
      burnedKcal: rows.reduce((s, r) => s + r.burned_kcal, 0),
      weightChange: weights.length >= 2 ? round(weights.at(-1)!.weight_kg! - weights[0].weight_kg!, 1) : null,
      calorieAdherence: adh.calories,
      proteinAdherence: adh.protein,
      waterAdherence: adh.water,
      supplementAdherence: planned ? Math.round((taken / planned) * 100) : null,
      bknScore: scores.length ? Math.round(avg(scores)) : null,
    };
  });
}
