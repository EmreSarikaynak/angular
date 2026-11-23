import { addDays } from "../dates";
import type { PantryItem, PantryLocation } from "../types";

export type PantryStatus = "expired" | "soon" | "ok" | "unknown";

/** Gün farkı (b - a), YYYY-MM-DD anahtarları arasında. */
function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Son tüketim günü: paketten okunan/girilen tarih, yoksa eklenme tarihi + tahmini saklama süresi. */
export function expiryDate(item: Pick<PantryItem, "expires_on" | "added_on" | "shelf_days">): string | null {
  if (item.expires_on) return item.expires_on;
  return item.shelf_days == null ? null : addDays(item.added_on, item.shelf_days);
}

/** Kalan gün (bugün dahil değil: son gün bugünse 0). Tarih bilinmiyorsa null. */
export function daysLeft(item: Pick<PantryItem, "expires_on" | "added_on" | "shelf_days">, today: string): number | null {
  const d = expiryDate(item);
  return d ? diffDays(today, d) : null;
}

/** Süresi geçmiş (<0), yaklaşan (0–3 gün), uygun ya da bilinmiyor. */
export function pantryStatus(item: Pick<PantryItem, "expires_on" | "added_on" | "shelf_days">, today: string, soonDays = 3): PantryStatus {
  const d = daysLeft(item, today);
  if (d == null) return "unknown";
  return d < 0 ? "expired" : d <= soonDays ? "soon" : "ok";
}

/** En acil olandan başlayarak; tarihi bilinmeyenler sonda. */
export function sortByUrgency<T extends Pick<PantryItem, "expires_on" | "added_on" | "shelf_days" | "name">>(items: readonly T[], today: string): T[] {
  return [...items].sort((a, b) => {
    const da = daysLeft(a, today);
    const db = daysLeft(b, today);
    if (da == null && db == null) return a.name.localeCompare(b.name, "tr");
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db || a.name.localeCompare(b.name, "tr");
  });
}

/** Karşılaştırma anahtarı: büyük/küçük harf ve Türkçe i/İ farkını yok sayar. */
export const normalizeName = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

export interface ScannedItem {
  name: string;
  expires_on: string | null;
  shelf_days: number | null;
}

/**
 * Yeni okunan ürünleri mevcut envanterle birleştirir (aynı konumda aynı ad = aynı ürün).
 * Var olan ürünün eklenme tarihi ve kullanıcının girdiği tarih korunur; paketten tarih okunduysa ve
 * eldeki yalnızca tahminse tarih güncellenir. Yeni ürünler bugünün tarihiyle eklenir.
 */
export function mergeScan(existing: readonly PantryItem[], scanned: readonly ScannedItem[], location: PantryLocation, today: string, newId: () => string) {
  const add: Omit<PantryItem, "user_id" | "created_at">[] = [];
  const update: Pick<PantryItem, "id" | "expires_on" | "shelf_days" | "expiry_source">[] = [];
  const known = new Map(existing.filter((e) => e.location === location).map((e) => [normalizeName(e.name), e]));
  const seen = new Set<string>();
  for (const s of scanned) {
    const key = normalizeName(s.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const have = known.get(key);
    if (have) {
      if (s.expires_on && have.expiry_source === "estimate") update.push({ id: have.id, expires_on: s.expires_on, shelf_days: have.shelf_days, expiry_source: "label" });
      continue;
    }
    add.push({ id: newId(), name: s.name.trim().slice(0, 80), location, added_on: today, expires_on: s.expires_on, shelf_days: s.expires_on ? null : s.shelf_days, expiry_source: s.expires_on ? "label" : "estimate" });
  }
  return { add, update };
}
