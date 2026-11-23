import type { DaySummary } from "../day";
import type { DailyLog, Profile, Supplement, SupplementLog } from "../types";

export type BknItemKey = "meals" | "protein" | "water" | "move" | "supplements" | "sleep";

export interface BknItem {
  key: BknItemKey;
  /** 0..1 arası tamamlanma. */
  progress: number;
  done: boolean;
}

/** Bugünkü takviye dozları: [takviye, saat, alındı mı]. */
export function supplementSlots(supplements: Supplement[], logs: SupplementLog[], date: string) {
  const out: { supplement: Supplement; time: string; log: SupplementLog | undefined }[] = [];
  for (const s of supplements.filter((x) => x.active)) {
    for (const time of [...s.times].sort()) out.push({ supplement: s, time, log: logs.find((l) => l.supplement_id === s.id && l.entry_date === date && l.time_slot === time) });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * "Bugün kendin için ne yaptın?" — günün öz bakım kontrol listesi ve 0–100 arası BKN skoru.
 * Yalnızca kullanıcının takip ettiği alanlar sayılır (takviyesi olmayan ya da uyku girmeyen
 * kullanıcının skoru bu yüzden düşmez).
 */
export function bknDay(
  s: DaySummary,
  profile: Pick<Profile, "kcal_target" | "protein_target_g" | "water_target_ml" | "steps_target"> | null,
  opts: { mealsLogged: number; daily?: DailyLog; slots?: { log: unknown }[]; exerciseMin?: number } = { mealsLogged: 0 },
): { items: BknItem[]; score: number } {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const items: BknItem[] = [];
  const add = (key: BknItemKey, progress: number) => items.push({ key, progress: clamp(progress), done: progress >= 1 });

  add("meals", opts.mealsLogged / 3);
  if (profile?.protein_target_g) add("protein", s.intake.protein_g / (profile.protein_target_g * 0.9));
  if (profile?.water_target_ml) add("water", s.water_ml / profile.water_target_ml);
  const stepPart = profile?.steps_target ? s.steps / profile.steps_target : 0;
  add("move", Math.max(stepPart, (opts.exerciseMin ?? 0) / 30, s.burned_kcal / 300));
  if (opts.slots?.length) add("supplements", opts.slots.filter((x) => x.log).length / opts.slots.length);
  if (opts.daily?.sleep_hours != null) add("sleep", opts.daily.sleep_hours / 7);

  const score = items.length ? Math.round((items.reduce((a, i) => a + i.progress, 0) / items.length) * 100) : 0;
  return { items, score };
}
