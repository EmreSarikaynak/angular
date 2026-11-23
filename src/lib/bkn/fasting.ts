import type { FastingSession } from "../types";

export const FASTING_PRESETS = [12, 14, 16, 18, 20];

export function elapsedHours(s: Pick<FastingSession, "started_at" | "ended_at">, now = Date.now()): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  return Math.max(0, (end - new Date(s.started_at).getTime()) / 3_600_000);
}

export function fastingProgress(s: Pick<FastingSession, "started_at" | "ended_at" | "target_hours">, now = Date.now()) {
  const hours = elapsedHours(s, now);
  const remaining = Math.max(0, s.target_hours - hours);
  return { hours, remaining, ratio: Math.min(1, hours / s.target_hours), done: hours >= s.target_hours, endsAt: new Date(new Date(s.started_at).getTime() + s.target_hours * 3_600_000) };
}

/** "13 sa 05 dk" biçimi için saat ve dakika. */
export function hm(hours: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(hours * 60));
  return { h: Math.floor(total / 60), m: total % 60 };
}

export function fastingStats(sessions: FastingSession[]) {
  const done = sessions.filter((s) => s.ended_at);
  const hours = done.map((s) => elapsedHours(s));
  return {
    completed: done.length,
    reached: done.filter((s) => elapsedHours(s) >= s.target_hours).length,
    average: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0,
    longest: hours.length ? Math.max(...hours) : 0,
  };
}

/** Takviye stoku kaç gün yeter? Stok takip edilmiyorsa null. */
export function stockDaysLeft(s: { stock_count?: number | null; per_dose?: number; times: string[]; active: boolean }): number | null {
  if (s.stock_count == null) return null;
  const perDay = (s.per_dose ?? 1) * Math.max(1, s.times.length);
  return Math.floor(s.stock_count / perDay);
}
export const LOW_STOCK_DAYS = 5;
