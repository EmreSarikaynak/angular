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

/**
 * Sessiz saat mi? Aralık gece yarısını aşabilir (22:00–08:00). Ramazan'da sahur uyanma saatinden önceki 90 dakika
 * sessiz saatin dışında tutulur (iftar–sahur arası hatırlatmaların anlamı kalsın).
 */
export function isQuiet(nowMin: number, startMin: number, endMin: number, ramadanSahurMin?: number | null): boolean {
  if (startMin === endMin) return false;
  if (ramadanSahurMin != null && inDailyWindow(nowMin, (ramadanSahurMin - 90 + 1440) % 1440, ramadanSahurMin)) return false;
  return inDailyWindow(nowMin, startMin, endMin);
}

/** IANA saat dilimi geçerli mi? */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "UTC+3", "UTC-5:30" gibi kısa gösterim (verilen anki farka göre). */
export function utcOffsetLabel(tz: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
    if (!m) return "UTC";
    const h = Number(m[2]);
    const min = Number(m[3] ?? 0);
    return `UTC${m[1]}${h}${min ? `:${String(min).padStart(2, "0")}` : ""}`;
  } catch {
    return "UTC";
  }
}

/** Tüm IANA saat dilimleri (tarayıcı destekliyorsa), yoksa kısa bir yedek liste. */
export function allTimeZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list?.length) return list;
  } catch {}
  return ["Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo", "Australia/Sydney", "UTC"];
}
