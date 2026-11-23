/** Bildirim saatleri 15 dakikalık adımlarla ayarlanır; zamanlayıcı da 15 dakikada bir çağrılır. */
export const STEP_MIN = 15;

export const toMinutes = (hour: number, minute = 0) => hour * 60 + minute;

/** "HH:MM" → gün başından itibaren dakika. */
export function parseHHMM(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatHHMM(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Şu an [start, end) aralığında mı? Aralık gece yarısını aşabilir (ör. 22:00–06:00). */
export function inDailyWindow(nowMin: number, startMin: number, endMin: number): boolean {
  return startMin <= endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}

/** Şu an, başlangıçtan itibaren `spanMin` dakikalık pencerede mi? (Gece yarısını aşan pencereler dahil.) */
export function inWindowFrom(nowMin: number, startMin: number, spanMin: number): boolean {
  const elapsed = (nowMin - startMin + 1440) % 1440;
  return elapsed < spanMin;
}

/** 00:00'dan 23:45'e 15 dakikalık seçenekler. */
export function quarterTimes(): string[] {
  return Array.from({ length: 1440 / STEP_MIN }, (_, i) => formatHHMM(i * STEP_MIN));
}
