import type { Sex } from "../types";

export type MicroKey = "iron_mg" | "calcium_mg" | "magnesium_mg" | "potassium_mg" | "vitamin_c_mg" | "vitamin_b12_mcg" | "vitamin_d_mcg";
export type Micros = Partial<Record<MicroKey, number>>;

export interface MicroDef {
  key: MicroKey;
  tr: string;
  en: string;
  unit: "mg" | "mcg";
  /** Yetişkinler için günlük referans alım (erkek / kadın). Genel değerlerdir; yaş, hamilelik vb. durumlarda farklılaşır. */
  male: number;
  female: number;
  /** Tek bir kalem için makul üst sınır (model hatalarını ayıklamak için). */
  max: number;
}

export const MICRO_DEFS: MicroDef[] = [
  { key: "iron_mg", tr: "Demir", en: "Iron", unit: "mg", male: 8, female: 18, max: 60 },
  { key: "calcium_mg", tr: "Kalsiyum", en: "Calcium", unit: "mg", male: 1000, female: 1000, max: 2500 },
  { key: "magnesium_mg", tr: "Magnezyum", en: "Magnesium", unit: "mg", male: 400, female: 310, max: 800 },
  { key: "potassium_mg", tr: "Potasyum", en: "Potassium", unit: "mg", male: 3500, female: 3500, max: 5000 },
  { key: "vitamin_c_mg", tr: "C vitamini", en: "Vitamin C", unit: "mg", male: 90, female: 75, max: 1000 },
  { key: "vitamin_b12_mcg", tr: "B12 vitamini", en: "Vitamin B12", unit: "mcg", male: 2.4, female: 2.4, max: 100 },
  { key: "vitamin_d_mcg", tr: "D vitamini", en: "Vitamin D", unit: "mcg", male: 15, female: 15, max: 100 },
];

export const MICRO_KEYS = MICRO_DEFS.map((d) => d.key);

export function microTarget(def: MicroDef, sex: Sex | null | undefined): number {
  return sex === "male" ? def.male : def.female;
}

/** Ham değerleri temizler: negatif/aşırı değerler atılır, boşsa null döner. */
export function cleanMicros(raw: unknown): Micros | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Micros = {};
  for (const def of MICRO_DEFS) {
    const v = Number((raw as Record<string, unknown>)[def.key]);
    if (isFinite(v) && v > 0 && v <= def.max) out[def.key] = Math.round(v * 100) / 100;
  }
  return Object.keys(out).length ? out : null;
}

export function scaleMicros(m: Micros | null | undefined, factor: number): Micros | null {
  if (!m || !isFinite(factor) || factor < 0) return m ?? null;
  const out: Micros = {};
  for (const k of MICRO_KEYS) if (m[k] != null) out[k] = Math.round(m[k]! * factor * 100) / 100;
  return out;
}

export function sumMicros(list: (Micros | null | undefined)[]): Record<MicroKey, number> {
  const total = Object.fromEntries(MICRO_KEYS.map((k) => [k, 0])) as Record<MicroKey, number>;
  for (const m of list) if (m) for (const k of MICRO_KEYS) total[k] += Number(m[k]) || 0;
  return total;
}
