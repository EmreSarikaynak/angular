import { activityType } from "../nutrition/activities";
import type { Activity, BodyMeasurement, DailyLog, HealthRing, Intensity } from "../types";

/**
 * Telefon sağlık deposundan (Apple Sağlık / Health Connect) okunan ham verilerin uygulamanın tablolarına eşlenmesi.
 * Bu dosya saf fonksiyonlardan oluşur (test edilebilir); okuma ve yazma işlemleri health.ts ve health-sync.ts içindedir.
 */

export interface DeviceDay {
  date: string;
  steps: number | null;
  distance_km: number | null;
  active_kcal: number | null;
  exercise_min: number | null;
  stand_hours: number | null;
  sleep_hours: number | null;
}
export interface DeviceWorkout {
  /** Platformun kalıcı kimliği; yoksa tür + başlangıçtan üretilir. */
  key: string;
  type: string;
  start: string;
  end: string;
  minutes: number;
  kcal: number | null;
  distance_km: number | null;
  source?: string;
}
export interface DeviceWeight {
  date: string;
  kg: number;
}

/** ISO zamanını cihazın yerel gününe çevirir (YYYY-MM-DD). */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const sumBy = <T,>(items: T[], date: (x: T) => string, value: (x: T) => number) => {
  const out = new Map<string, number>();
  for (const it of items) {
    const v = value(it);
    if (!Number.isFinite(v) || v < 0) continue;
    out.set(date(it), (out.get(date(it)) ?? 0) + v);
  }
  return out;
};

/** Günlük toplam (aggregate ya da ham örneklerden): başlangıç gününe göre. */
export function dailySum(samples: { startDate: string; value: number }[]): Map<string, number> {
  return sumBy(samples, (s) => localDateKey(s.startDate), (s) => s.value);
}

/** Uyku süresi (saat): uyanma gününe göre; yalnızca uyuyor evreleri sayılır (uyanık ve yatakta olma sayılmaz). */
export function sleepHoursByWakeDate(samples: { endDate: string; value: number; sleepState?: string }[]): Map<string, number> {
  const asleep = (s: string | undefined) => s == null || s === "asleep" || s === "light" || s === "deep" || s === "rem";
  const minutes = sumBy(samples.filter((s) => asleep(s.sleepState)), (s) => localDateKey(s.endDate), (s) => s.value);
  const out = new Map<string, number>();
  for (const [d, m] of minutes) if (m > 0) out.set(d, Math.min(16, Math.round((m / 60) * 10) / 10));
  return out;
}

/** Apple ayakta saatleri: ayakta kalınan her saat 1 örnektir; günlük toplam halkadaki sayıdır. */
export function standHoursByDate(samples: { startDate: string; value: number; standState?: string }[]): Map<string, number> {
  return sumBy(samples.filter((s) => s.standState == null || s.standState === "stood"), (s) => localDateKey(s.startDate), (s) => (s.value > 0 ? 1 : 0));
}

const WORKOUT_MAP: [RegExp, string][] = [
  [/^(walking|hiking|wheelchairWalkPace)$/, "walking"],
  [/^(running|runningTreadmill|trackAndField|wheelchairRunPace)$/, "running"],
  [/^(cycling|bikingStationary|handCycling)$/, "cycling"],
  [/^(swimming|swimmingPool|swimmingOpenWater|waterFitness|waterPolo)$/, "swimming"],
  [/^(yoga|taiChi|stretching|flexibility|mindAndBody|cooldown|preparationAndRecovery)$/, "yoga"],
  [/^(pilates|barre)$/, "pilates"],
  [/^(strengthTraining|traditionalStrengthTraining|functionalStrengthTraining|weightlifting|coreTraining|benchPress|deadlift|latPullDown|calisthenics|crunch|plank|lunge|upperTwist|forwardTwist)/, "weights"],
  [/^(soccer)$/, "football"],
  [/^(elliptical|stairClimbing|stairs|stepTraining|highIntensityIntervalTraining|crossTraining|rowing|rowingMachine|bootCamp|jumpRope|mixedCardio|exerciseClass|cardioDance|socialDance|dance|dancing|fitnessGaming|stairClimbingMachine|jumpingJack|burpee)$/, "fitness"],
];
/** Platformdaki antrenman türünü uygulamanın aktivite türlerinden birine eşler. */
export function mapWorkoutType(t: string): string {
  return WORKOUT_MAP.find(([re]) => re.test(t))?.[1] ?? "other";
}

/** Dakika başına kaloriye göre yoğunluk (kalori bilinmiyorsa orta). */
export function intensityFor(minutes: number, kcal: number | null): Intensity {
  if (kcal == null || minutes <= 0) return "moderate";
  const perMin = kcal / minutes;
  return perMin < 4 ? "low" : perMin < 8 ? "moderate" : "high";
}

/** Aynı girdiden hep aynı UUID (kararlı kimlik; yeniden eşitleme çift kayıt oluşturmaz). */
export function stableUuid(seed: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
    h3 = Math.imul(h3 ^ c, 2246822519);
    h4 = Math.imul(h4 ^ c, 3266489917);
  }
  const parts = [h1, h2, h3, h4].map((h, i) => (Math.imul(h ^ (h >>> (13 + i)), 1597334677) >>> 0).toString(16).padStart(8, "0"));
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface Existing {
  daily: DailyLog[];
  rings: HealthRing[];
  activities: Activity[];
  body: BodyMeasurement[];
}
export interface Plan {
  daily: Omit<DailyLog, "user_id">[];
  rings: Omit<HealthRing, "user_id">[];
  activities: Omit<Activity, "user_id">[];
  body: Omit<BodyMeasurement, "user_id">[];
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const DEFAULT_GOALS = { move_goal: 600, exercise_goal: 30, stand_goal: 12 };

/**
 * Eşitleme planı: hangi satırların yazılacağını belirler.
 * - Günlük kayıt: adım yalnızca boşsa ya da cihaz değeri daha büyükse (gün içinde artar), uyku yalnızca boşsa yazılır; ruh hali vb. korunur.
 * - Halka: kayıt yoksa ya da kaynağı "device" ise yazılır; elle girilen ya da ekran görüntüsünden okunan halka ezilmez.
 *   Hedefler: mevcut kayıt, yoksa son bilinen hedefler, yoksa varsayılanlar (cihaz hedef vermez).
 * - Antrenman: aynı türde ve ±10 dk içinde başlayan bir aktivite varsa atlanır (elle girilmiş olabilir); kararlı kimlikle çift kayıt oluşmaz.
 * - Kilo: o gün için ölçüm yoksa eklenir.
 */
export function planSync(input: { days: DeviceDay[]; workouts: DeviceWorkout[]; weights: DeviceWeight[]; existing: Existing; weightKg?: number | null; today: string }): Plan {
  const { days, workouts, weights, existing, today } = input;
  const plan: Plan = { daily: [], rings: [], activities: [], body: [] };
  const lastRing = [...existing.rings].filter((r) => r.move_goal || r.exercise_goal || r.stand_goal).sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0];
  const goals = { move_goal: lastRing?.move_goal ?? DEFAULT_GOALS.move_goal, exercise_goal: lastRing?.exercise_goal ?? DEFAULT_GOALS.exercise_goal, stand_goal: lastRing?.stand_goal ?? DEFAULT_GOALS.stand_goal };

  for (const d of days) {
    if (d.date > today) continue;
    const log = existing.daily.find((l) => l.entry_date === d.date);
    const steps = d.steps != null ? Math.round(d.steps) : null;
    const wantSteps = steps != null && (log?.steps == null || steps > log.steps);
    const wantSleep = d.sleep_hours != null && log?.sleep_hours == null;
    if (wantSteps || wantSleep) {
      plan.daily.push({
        id: log?.id ?? stableUuid(`daily:${d.date}`),
        entry_date: d.date,
        steps: wantSteps ? steps : (log?.steps ?? null),
        sleep_hours: wantSleep ? d.sleep_hours : (log?.sleep_hours ?? null),
        sleep_quality: log?.sleep_quality ?? null,
        mood: log?.mood ?? null,
        energy: log?.energy ?? null,
        stress: log?.stress ?? null,
        note: log?.note ?? null,
      });
    }

    const ring = existing.rings.find((r) => r.entry_date === d.date);
    const hasRingData = d.active_kcal != null || d.exercise_min != null || d.stand_hours != null;
    if (hasRingData && (!ring || ring.source === "device")) {
      plan.rings.push({
        id: ring?.id ?? stableUuid(`ring:${d.date}`),
        entry_date: d.date,
        move_kcal: d.active_kcal != null ? Math.round(d.active_kcal) : null,
        move_goal: ring?.move_goal ?? goals.move_goal,
        exercise_min: d.exercise_min != null ? Math.round(d.exercise_min) : null,
        exercise_goal: ring?.exercise_goal ?? goals.exercise_goal,
        stand_hours: d.stand_hours != null ? Math.round(d.stand_hours) : null,
        stand_goal: ring?.stand_goal ?? goals.stand_goal,
        steps,
        distance_km: d.distance_km != null ? round(d.distance_km, 2) : null,
        source: "device",
      });
    }
  }

  const weight = input.weightKg ?? 70;
  const taken = [...existing.activities];
  for (const w of workouts) {
    const date = localDateKey(w.start);
    if (date > today || !(w.minutes > 0)) continue;
    const type = mapWorkoutType(w.type);
    const start = new Date(w.start).getTime();
    const dup = taken.some((a) => a.type === type && Math.abs(new Date(a.started_at).getTime() - start) <= 10 * 60_000);
    if (dup) continue;
    const intensity = intensityFor(w.minutes, w.kcal);
    const met = activityType(type).met[intensity];
    const kcal = w.kcal != null ? Math.round(w.kcal) : Math.round(Math.max(0, met - 1) * weight * (w.minutes / 60));
    const row = {
      id: stableUuid(`workout:${w.key}`),
      entry_date: date,
      started_at: new Date(w.start).toISOString(),
      type,
      name: null,
      duration_min: Math.max(1, Math.round(w.minutes)),
      distance_km: w.distance_km != null ? round(w.distance_km, 2) : null,
      intensity,
      met,
      kcal_burned: kcal,
      note: w.source ? `Cihazdan: ${w.source}` : "Cihazdan",
    };
    plan.activities.push(row);
    taken.push(row as Activity);
  }

  for (const w of weights) {
    if (w.date > today || existing.body.some((b) => b.entry_date === w.date) || plan.body.some((b) => b.entry_date === w.date)) continue;
    plan.body.push({ id: stableUuid(`weight:${w.date}`), entry_date: w.date, weight_kg: round(w.kg, 1), waist_cm: null, hip_cm: null, chest_cm: null, body_fat_pct: null, bmi: null, note: null });
  }
  return plan;
}
