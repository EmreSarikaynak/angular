"use client";
import { fetchRange, upsertRow } from "./data/store";
import { addDays, toDateKey } from "./dates";
import { planSync } from "./bkn/health-map";
import { healthState, readDeviceData, saveHealthState } from "./health";
import type { Activity, BodyMeasurement, DailyLog, HealthRing } from "./types";

export interface SyncResult {
  days: number;
  rings: number;
  activities: number;
  body: number;
  errors: string[];
}

let running = false;

/** Son `daysBack` günü telefon sağlık deposundan okuyup günlüğe yazar. Aynı anda tek eşitleme çalışır. */
export async function runHealthSync(daysBack = 3, weightKg?: number | null): Promise<SyncResult | null> {
  const state = healthState();
  if (running || !state.connected || state.scopes.length === 0) return null;
  running = true;
  try {
    const today = toDateKey();
    const from = addDays(today, -(daysBack - 1));
    const data = await readDeviceData(daysBack, state.scopes);
    const [daily, rings, activities, body] = await Promise.all([
      fetchRange<DailyLog & { [k: string]: unknown }>("daily_logs", from, today),
      fetchRange<HealthRing & { [k: string]: unknown }>("health_rings", addDays(today, -35), today),
      fetchRange<Activity & { [k: string]: unknown }>("activities", from, today, "started_at"),
      fetchRange<BodyMeasurement & { [k: string]: unknown }>("body_measurements", from, today),
    ]);
    const plan = planSync({ days: data.days, workouts: data.workouts, weights: data.weights, existing: { daily, rings, activities, body }, weightKg, today });
    for (const r of plan.daily) await upsertRow("daily_logs", r, "user_id,entry_date");
    for (const r of plan.rings) await upsertRow("health_rings", r, "user_id,entry_date");
    for (const r of plan.activities) await upsertRow("activities", r);
    for (const r of plan.body) await upsertRow("body_measurements", r);
    saveHealthState({ lastSync: new Date().toISOString() });
    return { days: plan.daily.length, rings: plan.rings.length, activities: plan.activities.length, body: plan.body.length, errors: data.errors };
  } finally {
    running = false;
  }
}
