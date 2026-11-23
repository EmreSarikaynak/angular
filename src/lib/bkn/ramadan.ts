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
