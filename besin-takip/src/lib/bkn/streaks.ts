import type { DayRow } from "../stats";
import type { Profile } from "../types";

export type BadgeKey = "first_log" | "streak_3" | "streak_7" | "streak_30" | "streak_100" | "water_7" | "protein_7" | "active_10" | "steps_7" | "supplements_7" | "logs_100" | "weight_first_kg";

export interface Badge {
  key: BadgeKey;
  earned: boolean;
  /** Bir sonraki adıma ilerleme (0..1). */
  progress: number;
}

export interface Streaks {
  /** Bugün (ya da bugün henüz kayıt yoksa dün) biten kesintisiz kayıt günü sayısı. */
  current: number;
  longest: number;
  waterCurrent: number;
  loggedDays: number;
  badges: Badge[];
}

function runEndingAt(rows: DayRow[], ok: (r: DayRow) => boolean): number {
  let i = rows.length - 1;
  // Gün henüz bitmediği için bugünün eksikliği seriyi bozmaz.
  if (i >= 0 && !ok(rows[i])) i--;
  let n = 0;
  for (; i >= 0 && ok(rows[i]); i--) n++;
  return n;
}

function longestRun(rows: DayRow[], ok: (r: DayRow) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const r of rows) {
    cur = ok(r) ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/**
 * Seriler ve rozetler. `rows` tarih sırasıyla, son eleman bugün olmalıdır.
 * Tümü kullanıcının kendi kayıtlarından hesaplanır; ayrı bir tabloda tutulmaz.
 */
export function computeStreaks(
  rows: DayRow[],
  profile: Pick<Profile, "protein_target_g" | "water_target_ml" | "steps_target" | "start_weight_kg" | "weight_kg" | "goal"> | null,
  extra: { activityCount: number; supplementPerfectDays: number; totalEntries: number },
): Streaks {
  const logged = (r: DayRow) => r.logged;
  const waterOk = (r: DayRow) => !!profile?.water_target_ml && r.water_ml >= profile.water_target_ml;
  const proteinDays = rows.filter((r) => r.logged && !!profile?.protein_target_g && r.intake.protein_g >= profile.protein_target_g * 0.9).length;
  const stepDays = rows.filter((r) => !!profile?.steps_target && r.steps >= profile.steps_target).length;
  const longest = longestRun(rows, logged);
  const longestWater = longestRun(rows, waterOk);
  const loggedDays = rows.filter(logged).length;
  const moved = profile?.start_weight_kg != null && profile.weight_kg != null ? (profile.goal === "gain" ? profile.weight_kg - profile.start_weight_kg : profile.start_weight_kg - profile.weight_kg) : 0;

  const badge = (key: BadgeKey, value: number, goal: number): Badge => ({ key, earned: value >= goal, progress: Math.max(0, Math.min(1, value / goal)) });
  return {
    current: runEndingAt(rows, logged),
    longest,
    waterCurrent: runEndingAt(rows, waterOk),
    loggedDays,
    badges: [
      badge("first_log", loggedDays, 1),
      badge("streak_3", longest, 3),
      badge("streak_7", longest, 7),
      badge("streak_30", longest, 30),
      badge("streak_100", longest, 100),
      badge("water_7", longestWater, 7),
      badge("protein_7", proteinDays, 7),
      badge("steps_7", stepDays, 7),
      badge("active_10", extra.activityCount, 10),
      badge("supplements_7", extra.supplementPerfectDays, 7),
      badge("logs_100", extra.totalEntries, 100),
      badge("weight_first_kg", profile?.goal === "maintain" ? 0 : moved, 1),
    ],
  };
}
