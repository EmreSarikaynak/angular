import type { Lang, Meal } from "../types";
import { MEAL_LABELS } from "../i18n/labels";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** İftar ile sahur (imsak) arasındaki yeme-içme penceresinde miyiz? Pencere gece yarısını aşar. */
export function inEatingWindow(nowMin: number, iftar: string, sahur: string): boolean {
  const i = toMin(iftar);
  const s = toMin(sahur);
  return i <= s ? nowMin >= i && nowMin < s : nowMin >= i || nowMin < s;
}

/** Sıradaki olay (iftar ya da sahur sonu) ve kalan dakika. */
export function nextRamadanEvent(nowMin: number, iftar: string, sahur: string): { kind: "iftar" | "sahur"; minutes: number } {
  const eating = inEatingWindow(nowMin, iftar, sahur);
  const target = toMin(eating ? sahur : iftar);
  return { kind: eating ? "sahur" : "iftar", minutes: (target - nowMin + 1440) % 1440 };
}

/** Yeme penceresinin uzunluğu (dakika) ve su hedefi için saat başı öneri. */
export function waterPlan(targetMl: number, iftar: string, sahur: string): { windowMin: number; perHourMl: number } {
  const windowMin = (toMin(sahur) - toMin(iftar) + 1440) % 1440 || 1440;
  // Uyku payı: pencerenin yaklaşık yarısında uyanık olunduğu varsayılır.
  const awakeHours = Math.max(2, windowMin / 60 / 2);
  return { windowMin, perHourMl: Math.round(targetMl / awakeHours / 50) * 50 };
}

/** Ramazan modunda kahvaltı "Sahur", akşam yemeği "İftar" olarak adlandırılır (veri yapısı değişmez). */
export function mealLabel(meal: Meal | string, lang: Lang, ramadan: boolean | undefined): string {
  if (ramadan && meal === "breakfast") return lang === "en" ? "Suhoor" : "Sahur";
  if (ramadan && meal === "dinner") return lang === "en" ? "Iftar" : "İftar";
  return MEAL_LABELS[meal]?.[lang] ?? meal;
}

/** Ramazan modunda saate göre varsayılan öğün. */
export function ramadanDefaultMeal(nowMin: number, iftar: string, sahur: string): "breakfast" | "dinner" | "night" {
  const i = toMin(iftar);
  const s = toMin(sahur);
  const sinceIftar = (nowMin - i + 1440) % 1440;
  const untilSahur = (s - nowMin + 1440) % 1440;
  if (untilSahur <= 150) return "breakfast";
  return sinceIftar <= 180 ? "dinner" : "night";
}

const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const round5 = (n: number) => Math.round(n / 5) * 5;

export interface RamadanSlot {
  key: "iftar" | "snack" | "sahur";
  time: string;
  kcal: number;
  protein_g: number;
}

/**
 * Oruçlu gün için günlük hedefleri üç öğüne böler: iftar, iftardan ~2 saat sonra ara öğün ve sahur.
 * Protein yeme penceresine yayılır (iftar %35, ara öğün %25, sahur %40); kalori %40 / %20 / %40.
 * Sahur, imsaktan ~45 dakika önceye konur. Değerler hedeflerin bölünmesidir, tıbbi öneri değildir.
 */
export function ramadanProgram(kcalTarget: number, proteinTarget: number, iftar: string, sahur: string): RamadanSlot[] {
  const kcal = [0.4, 0.2, 0.4];
  const protein = [0.35, 0.25, 0.4];
  const times = [toMin(iftar), toMin(iftar) + 120, toMin(sahur) - 45];
  const keys = ["iftar", "snack", "sahur"] as const;
  return keys.map((key, i) => ({ key, time: fmt(times[i]), kcal: round5(kcalTarget * kcal[i]), protein_g: round5(proteinTarget * protein[i]) }));
}
