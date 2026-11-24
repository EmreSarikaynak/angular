"use client";
import { timestampFor } from "../dates";
import type { DailyLog, Supplement, SupplementLog } from "../types";
import { deleteRow, upsertRow, uuid } from "./store";

export function addWater(date: string, amountMl: number) {
  return upsertRow("water_logs", { id: uuid(), entry_date: date, logged_at: timestampFor(date), amount_ml: Math.round(amountMl) });
}

/** Günlük durum satırını (adım, uyku, ruh hali) günceller; gün başına tek satır tutulur. */
export function saveDaily(date: string, existing: DailyLog | undefined, patch: Partial<DailyLog>) {
  const base: DailyLog = existing ?? { id: uuid(), entry_date: date, steps: null, sleep_hours: null, sleep_quality: null, mood: null, energy: null, stress: null, note: null };
  const { id, entry_date, steps, sleep_hours, sleep_quality, sleep_bedtime, sleep_waketime, mood, energy, stress, note } = { ...base, ...patch };
  return upsertRow("daily_logs", { id, entry_date, steps, sleep_hours, sleep_quality, mood, energy, stress, note, ...(sleep_bedtime || sleep_waketime ? { sleep_bedtime: sleep_bedtime ?? null, sleep_waketime: sleep_waketime ?? null } : {}) }, "user_id,entry_date");
}

function supplementRow(s: Supplement, stock: number | null) {
  return { id: s.id, name: s.name, dose: s.dose, times: s.times, active: s.active, note: s.note, stock_count: stock, per_dose: s.per_dose ?? 1 };
}

/** Takviyeyi alındı olarak işaretler; stok takip ediliyorsa doz kadar düşer. */
export async function takeSupplement(s: Supplement, date: string, time: string) {
  await upsertRow("supplement_logs", { id: uuid(), supplement_id: s.id, entry_date: date, time_slot: time, taken_at: new Date().toISOString() });
  if (s.stock_count != null) await upsertRow("supplements", supplementRow(s, Math.max(0, s.stock_count - (s.per_dose ?? 1))));
}

/** İşareti geri alır; düşülen stok iade edilir. */
export async function untakeSupplement(s: Supplement, log: SupplementLog) {
  await deleteRow("supplement_logs", log.id);
  if (s.stock_count != null) await upsertRow("supplements", supplementRow(s, s.stock_count + (s.per_dose ?? 1)));
}
