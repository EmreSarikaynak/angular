import { addDays } from "../dates";

/**
 * Önümüzdeki yılların Ramazan ayları (başlangıç ve son oruç günü, dahil).
 * Tarihler Hicri (Ümmü'l-Kurâ) takvimden hesaplanmıştır; Diyanet takvimi ile en fazla bir gün
 * fark edebilir. Bu yüzden soru, Ramazan'dan 3 gün önce sorulur ve ay boyunca geçerli kalır.
 * Liste 2036'da biter; yeni yıllar eklenmelidir.
 */
export const RAMADAN_PERIODS: readonly { start: string; end: string }[] = [
  { start: "2026-02-18", end: "2026-03-19" },
  { start: "2027-02-08", end: "2027-03-08" },
  { start: "2028-01-28", end: "2028-02-25" },
  { start: "2029-01-16", end: "2029-02-13" },
  { start: "2030-01-05", end: "2030-02-03" },
  { start: "2030-12-26", end: "2031-01-23" },
  { start: "2031-12-16", end: "2032-01-13" },
  { start: "2032-12-04", end: "2033-01-02" },
  { start: "2033-11-23", end: "2033-12-22" },
  { start: "2034-11-12", end: "2034-12-11" },
  { start: "2035-11-01", end: "2035-11-30" },
  { start: "2036-10-21", end: "2036-11-18" },
];

/** Sorunun gösterilmeye başlandığı gün sayısı (Ramazan başlamadan önce). */
export const RAMADAN_LEAD_DAYS = 3;

/** Verilen gün (YYYY-MM-DD), bir Ramazan'ın başlamasına 3 gün kala ile son günü arasındaysa o Ramazan'ı döndürür. */
export function activeRamadan(dateKey: string): { start: string; end: string } | null {
  return RAMADAN_PERIODS.find((p) => dateKey >= addDays(p.start, -RAMADAN_LEAD_DAYS) && dateKey <= p.end) ?? null;
}

/** Başlangıç tarihiyle tanımlanan Ramazan, verilen günden önce bitmiş mi? */
export function ramadanEnded(startKey: string, dateKey: string): boolean {
  const p = RAMADAN_PERIODS.find((x) => x.start === startKey);
  return !!p && dateKey > p.end;
}
