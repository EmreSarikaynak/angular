/** Yerel saat dilimine göre YYYY-MM-DD. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86400000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Seçilen gün + şu anki saat (geçmiş güne kayıt eklerken saat bilgisi korunur). */
export function timestampFor(dateKey: string, time?: string): string {
  const now = new Date();
  const d = fromDateKey(dateKey);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
  }
  return d.toISOString();
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(key: string, lang: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", opts ?? { day: "numeric", month: "long", weekday: "long" }).format(
    fromDateKey(key),
  );
}

export function formatShort(key: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "short" }).format(fromDateKey(key));
}

export function ageFrom(birthDate: string, today: Date = new Date()): number {
  const b = fromDateKey(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

/** Saate göre varsayılan öğün. */
export function defaultMeal(d: Date = new Date()): "breakfast" | "lunch" | "dinner" | "snack" | "night" {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 18) return "snack";
  if (h >= 18 && h < 22) return "dinner";
  return "night";
}
