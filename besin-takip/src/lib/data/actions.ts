"use client";
import { timestampFor } from "../dates";
import type { DailyLog } from "../types";
import { upsertRow, uuid } from "./store";

export function addWater(date: string, amountMl: number) {
  return upsertRow("water_logs", { id: uuid(), entry_date: date, logged_at: timestampFor(date), amount_ml: Math.round(amountMl) });
}

/** Günlük durum satırını (adım, uyku, ruh hali) günceller; gün başına tek satır tutulur. */
export function saveDaily(date: string, existing: DailyLog | undefined, patch: Partial<DailyLog>) {
  const base: DailyLog = existing ?? { id: uuid(), entry_date: date, steps: null, sleep_hours: null, sleep_quality: null, mood: null, energy: null, stress: null, note: null };
  const { id, entry_date, steps, sleep_hours, sleep_quality, mood, energy, stress, note } = { ...base, ...patch };
  return upsertRow("daily_logs", { id, entry_date, steps, sleep_hours, sleep_quality, mood, energy, stress, note }, "user_id,entry_date");
}
