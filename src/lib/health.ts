"use client";
import { isNative } from "./native";
import { dailySum, localDateKey, sleepHoursByWakeDate, standHoursByDate, type DeviceDay, type DeviceWeight, type DeviceWorkout } from "./bkn/health-map";

/**
 * Telefon sağlık deposu: iOS'ta Apple Sağlık (HealthKit; Apple Watch verileri dahil), Android'de Health Connect
 * (Galaxy Watch, Pixel Watch, Garmin, Fitbit vb. verilerini toplar). Yalnızca mağaza/native uygulamada çalışır; yalnızca OKUR.
 */
export type HealthScope = "steps" | "rings" | "sleep" | "workouts" | "weight";
export const ALL_SCOPES: HealthScope[] = ["steps", "rings", "sleep", "workouts", "weight"];

type Plugin = typeof import("@capgo/capacitor-health").Health;
type DataType = import("@capgo/capacitor-health").HealthDataType;
const load = async (): Promise<Plugin> => (await import("@capgo/capacitor-health")).Health;

const TYPES: Record<HealthScope, DataType[]> = {
  steps: ["steps", "distance"],
  rings: ["calories", "exerciseTime", "appleStandHour"],
  sleep: ["sleep"],
  workouts: ["workouts"],
  weight: ["weight"],
};

export interface HealthState {
  connected: boolean;
  scopes: HealthScope[];
  lastSync: string | null;
}
const KEY = "bt:health";
export function healthState(): HealthState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<HealthState> | null;
    if (v) return { connected: !!v.connected, scopes: (v.scopes ?? []).filter((s): s is HealthScope => ALL_SCOPES.includes(s as HealthScope)), lastSync: v.lastSync ?? null };
  } catch {
    /* yoksay */
  }
  return { connected: false, scopes: [], lastSync: null };
}
export function saveHealthState(patch: Partial<HealthState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...healthState(), ...patch }));
  } catch {
    /* yoksay */
  }
}

export async function healthAvailable(): Promise<{ available: boolean; reason?: string }> {
  if (!isNative()) return { available: false, reason: "web" };
  try {
    const r = await (await load()).isAvailable();
    return { available: !!r.available, reason: r.reason };
  } catch (e) {
    return { available: false, reason: (e as Error).message };
  }
}

/** Sistem izin penceresini açar (yalnızca okuma). Reddedilen kapsamlar çıkarılarak kaydedilir. */
export async function connectHealth(scopes: HealthScope[]): Promise<{ granted: HealthScope[] }> {
  const Health = await load();
  const read = [...new Set(scopes.flatMap((s) => TYPES[s]))];
  await Health.requestAuthorization({ read, write: [] });
  // İzin durumu platforma göre farklı bildirilir (iOS okuma iznini gizler); bu yüzden istenenler kabul edilmiş sayılır
  // ve okuma sonuçsuz kalırsa kullanıcıya sistem ayarlarından kontrol etmesi söylenir.
  saveHealthState({ connected: true, scopes });
  return { granted: scopes };
}

export function disconnectHealth() {
  saveHealthState({ connected: false, scopes: [], lastSync: null });
}

export async function openSystemHealthSettings() {
  try {
    await (await load()).openHealthConnectSettings();
  } catch {
    /* iOS'ta yok */
  }
}

export interface DeviceData {
  days: DeviceDay[];
  workouts: DeviceWorkout[];
  weights: DeviceWeight[];
  errors: string[];
}

const iso = (d: Date) => d.toISOString();
const mapKeys = <T,>(...maps: Map<string, T>[]) => [...new Set(maps.flatMap((m) => [...m.keys()]))];

/** Son `days` günün verilerini okur. Bir veri türü okunamazsa (izin yok, platformda yok) diğerleri etkilenmez. */
export async function readDeviceData(daysBack: number, scopes: HealthScope[]): Promise<DeviceData> {
  const Health = await load();
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysBack - 1));
  const range = { startDate: iso(start), endDate: iso(end) };
  const errors: string[] = [];
  const guard = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`);
      return fallback;
    }
  };
  const aggregate = (dataType: DataType) =>
    guard(`aggregate ${dataType}`, async () => dailySum((await Health.queryAggregated({ dataType, ...range, bucket: "day", aggregation: "sum" })).samples.map((s) => ({ startDate: s.startDate, value: s.value }))), new Map<string, number>());

  const has = (s: HealthScope) => scopes.includes(s);
  const [steps, distance, calories, exercise, stand, sleep, workoutsRaw, weightsRaw] = await Promise.all([
    has("steps") ? aggregate("steps") : new Map<string, number>(),
    has("steps") ? aggregate("distance") : new Map<string, number>(),
    has("rings") ? aggregate("calories") : new Map<string, number>(),
    has("rings") ? aggregate("exerciseTime") : new Map<string, number>(),
    has("rings") ? guard("stand", async () => standHoursByDate((await Health.readSamples({ dataType: "appleStandHour", ...range, limit: 2000, ascending: true })).samples), new Map<string, number>()) : new Map<string, number>(),
    has("sleep")
      ? guard("sleep", async () => {
          // Uyku bir önceki akşam başlar; uyanma gününü yakalamak için bir gün geriden okunur.
          const from = new Date(start);
          from.setDate(from.getDate() - 1);
          return sleepHoursByWakeDate((await Health.readSamples({ dataType: "sleep", startDate: iso(from), endDate: iso(end), limit: 1000, ascending: true })).samples);
        }, new Map<string, number>())
      : new Map<string, number>(),
    has("workouts") || has("rings") ? guard("workouts", async () => (await Health.queryWorkouts({ ...range, limit: 200, ascending: true })).workouts, []) : [],
    has("weight") ? guard("weight", async () => (await Health.readSamples({ dataType: "weight", ...range, limit: 100, ascending: true })).samples, []) : [],
  ]);

  const workouts: DeviceWorkout[] = workoutsRaw.map((w) => ({
    key: w.platformId ?? `${w.workoutType}|${w.startDate}`,
    type: w.workoutType,
    start: w.startDate,
    end: w.endDate,
    minutes: w.duration > 600 ? w.duration / 60 : w.duration, // eklenti saniye de dakika da döndürebilir; 10 saatten uzun antrenman yok varsayımı
    kcal: w.totalEnergyBurned ?? null,
    distance_km: w.totalDistance != null ? w.totalDistance / 1000 : null,
    source: w.sourceName,
  }));
  // Egzersiz dakikası yalnızca iOS'ta doğrudan gelir; Android'de antrenman sürelerinden türetilir.
  const exerciseFromWorkouts = new Map<string, number>();
  if (exercise.size === 0) for (const w of workouts) exerciseFromWorkouts.set(localDateKey(w.start), (exerciseFromWorkouts.get(localDateKey(w.start)) ?? 0) + w.minutes);

  const days: DeviceDay[] = mapKeys(steps, distance, calories, exercise, exerciseFromWorkouts, stand, sleep).map((date) => ({
    date,
    steps: steps.get(date) ?? null,
    distance_km: distance.has(date) ? (distance.get(date) as number) / 1000 : null,
    active_kcal: calories.get(date) ?? null,
    exercise_min: exercise.get(date) ?? exerciseFromWorkouts.get(date) ?? null,
    stand_hours: stand.get(date) ?? null,
    sleep_hours: sleep.get(date) ?? null,
  }));
  const weights: DeviceWeight[] = weightsRaw.map((s) => ({ date: localDateKey(s.startDate), kg: s.value }));
  return { days: days.sort((a, b) => a.date.localeCompare(b.date)), workouts: has("workouts") ? workouts : [], weights, errors };
}
