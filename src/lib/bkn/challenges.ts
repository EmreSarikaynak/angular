import { addDays } from "../dates";
import type { DayRow } from "../stats";
import type { Profile } from "../types";

export type ChallengeMetric = "logging" | "water" | "protein" | "steps";

/** Bir günün meydan okuma ölçütünü karşılayıp karşılamadığı. */
export function dayMeets(metric: ChallengeMetric, r: DayRow, profile: Pick<Profile, "protein_target_g" | "water_target_ml" | "steps_target"> | null): boolean {
  if (metric === "logging") return r.logged;
  if (metric === "water") return !!profile?.water_target_ml && r.water_ml >= profile.water_target_ml;
  if (metric === "protein") return r.logged && !!profile?.protein_target_g && r.intake.protein_g >= profile.protein_target_g * 0.9;
  return !!profile?.steps_target && r.steps >= profile.steps_target;
}

export function challengeEnd(start: string, days: number): string {
  return addDays(start, days - 1);
}

export function challengeProgress(metric: ChallengeMetric, rows: DayRow[], profile: Parameters<typeof dayMeets>[2]): number {
  return rows.filter((r) => dayMeets(metric, r, profile)).length;
}

/** Karıştırılması zor karakterlerden (0/O, 1/I yok) 8 haneli katılım kodu. */
export function makeJoinCode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes.slice(0, 8), (b) => alphabet[b % alphabet.length]).join("");
}
