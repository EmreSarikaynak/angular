import { addDays, daysBetween } from "../dates";
import type { CycleLog } from "../types";

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

export interface CycleInfo {
  /** Son adet başlangıcından bu yana geçen gün (1 = ilk gün). */
  day: number;
  phase: CyclePhase;
  averageLength: number;
  averagePeriod: number;
  /** Ortalamanın dayandığı döngü sayısı (0 ise varsayılan 28 gün kullanılır). */
  basedOn: number;
  nextStart: string;
  daysUntilNext: number;
  /** Adet öncesi dönem: su tutulumu ve iştah artışı sık görülür. */
  premenstrual: boolean;
  ongoing: boolean;
}

const DEFAULT_LENGTH = 28;
const DEFAULT_PERIOD = 5;

/**
 * Döngü özeti. Tahminler yalnızca kullanıcının girdiği geçmiş başlangıç tarihlerinin ortalamasına
 * dayanır; doğum kontrolü ya da tıbbi karar için kullanılmamalıdır.
 */
export function cycleInfo(logs: CycleLog[], today: string): CycleInfo | null {
  const sorted = [...logs].filter((l) => l.entry_date <= today).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const last = sorted.at(-1);
  if (!last) return null;

  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = daysBetween(sorted[i - 1].entry_date, sorted[i].entry_date);
    // Olağan dışı aralıklar (atlanmış kayıt vb.) ortalamayı bozmasın.
    if (d >= 18 && d <= 45) lengths.push(d);
  }
  const recent = lengths.slice(-6);
  const averageLength = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : DEFAULT_LENGTH;
  const periods = sorted.filter((l) => l.end_date).map((l) => daysBetween(l.entry_date, l.end_date!) + 1).slice(-6);
  const averagePeriod = periods.length ? Math.round(periods.reduce((a, b) => a + b, 0) / periods.length) : DEFAULT_PERIOD;

  const day = daysBetween(last.entry_date, today) + 1;
  const ongoing = last.end_date ? today <= last.end_date : day <= averagePeriod;
  let nextStart = addDays(last.entry_date, averageLength);
  // Beklenen tarih geçtiyse (gecikme) tahmin bugüne çekilir.
  if (nextStart < today) nextStart = today;
  const daysUntilNext = daysBetween(today, nextStart);
  const ovulationDay = averageLength - 14;
  const phase: CyclePhase = ongoing ? "menstrual" : day < ovulationDay - 1 ? "follicular" : day <= ovulationDay + 1 ? "ovulation" : "luteal";
  return { day, phase, averageLength, averagePeriod, basedOn: recent.length, nextStart, daysUntilNext, premenstrual: !ongoing && daysUntilNext <= 5 && day > averagePeriod, ongoing };
}
