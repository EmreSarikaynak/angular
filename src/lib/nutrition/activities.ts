import type { Activity, Intensity } from "../types";

export interface ActivityType {
  key: string;
  /** MET değerleri: Compendium of Physical Activities (Ainsworth ve ark.) yaklaşık değerleri. */
  met: Record<Intensity, number>;
  hasDistance: boolean;
  /** Dakikadaki yaklaşık adım; adım sayısıyla çifte sayımı önlemek için. */
  stepsPerMin?: number;
  stepsPerKm?: number;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { key: "walking", met: { low: 2.8, moderate: 3.5, high: 4.8 }, hasDistance: true, stepsPerMin: 105, stepsPerKm: 1350 },
  { key: "running", met: { low: 7.0, moderate: 9.8, high: 11.8 }, hasDistance: true, stepsPerMin: 160, stepsPerKm: 1050 },
  { key: "pilates", met: { low: 2.5, moderate: 3.0, high: 4.0 }, hasDistance: false },
  { key: "fitness", met: { low: 3.5, moderate: 5.0, high: 7.5 }, hasDistance: false },
  { key: "cycling", met: { low: 4.0, moderate: 6.8, high: 10.0 }, hasDistance: true },
  { key: "swimming", met: { low: 4.8, moderate: 6.0, high: 9.8 }, hasDistance: true },
  { key: "yoga", met: { low: 2.0, moderate: 2.5, high: 4.0 }, hasDistance: false },
  { key: "weights", met: { low: 3.0, moderate: 3.5, high: 6.0 }, hasDistance: false },
  { key: "football", met: { low: 5.0, moderate: 7.0, high: 10.0 }, hasDistance: false },
  { key: "housework", met: { low: 2.3, moderate: 3.3, high: 4.0 }, hasDistance: false },
  { key: "other", met: { low: 3.0, moderate: 4.5, high: 6.5 }, hasDistance: false },
];

export function activityType(key: string): ActivityType {
  return ACTIVITY_TYPES.find((a) => a.key === key) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}

/** Hız (km/sa) biliniyorsa MET değerini hıza göre belirle. */
export function metFor(typeKey: string, intensity: Intensity, durationMin: number, distanceKm?: number | null): number {
  const type = activityType(typeKey);
  if (distanceKm && distanceKm > 0 && durationMin > 0) {
    const kmh = distanceKm / (durationMin / 60);
    if (typeKey === "walking") {
      if (kmh < 3.2) return 2.5;
      if (kmh < 4.5) return 3.0;
      if (kmh < 5.5) return 3.8;
      if (kmh < 6.5) return 4.8;
      return 6.0;
    }
    if (typeKey === "running") {
      if (kmh < 7) return 6.5;
      if (kmh < 8.5) return 8.3;
      if (kmh < 10.5) return 9.8;
      if (kmh < 12) return 11.0;
      if (kmh < 13.5) return 11.8;
      return 12.8;
    }
    if (typeKey === "cycling") {
      if (kmh < 16) return 4.0;
      if (kmh < 19) return 6.8;
      if (kmh < 22.5) return 8.0;
      if (kmh < 25.5) return 10.0;
      return 12.0;
    }
    if (typeKey === "swimming") {
      if (kmh < 1.5) return 4.8;
      if (kmh < 2.5) return 6.0;
      if (kmh < 3.5) return 8.3;
      return 9.8;
    }
  }
  return type.met[intensity];
}

/**
 * Aktivitenin NET yaktığı enerji: (MET − 1) × kg × saat.
 * Dinlenme harcaması (1 MET) zaten günlük enerji ihtiyacına (BMR/TDEE) dahil olduğu için
 * çıkarılır; böylece aynı enerji iki kez sayılmaz.
 */
export function activityKcal(met: number, weightKg: number, durationMin: number): number {
  const net = Math.max(0, met - 1) * weightKg * (durationMin / 60);
  return Math.round(net);
}

/** Bir aktivitenin karşılık geldiği tahmini adım sayısı (yalnızca yürüyüş/koşu). */
export function activitySteps(a: Pick<Activity, "type" | "duration_min" | "distance_km">): number {
  const type = activityType(a.type);
  if (!type.stepsPerMin) return 0;
  if (a.distance_km && a.distance_km > 0 && type.stepsPerKm) return Math.round(a.distance_km * type.stepsPerKm);
  return Math.round(a.duration_min * type.stepsPerMin);
}

/**
 * Adımlardan net enerji. Kayıtlı yürüyüş/koşu aktivitelerinin adımları düşülür ki
 * aynı hareket hem adım hem aktivite olarak iki kez sayılmasın.
 * ~0.5 kcal/kg/km net yürüme maliyeti, 1 km ≈ 1350 adım.
 */
export function stepsKcal(steps: number, weightKg: number, activities: Pick<Activity, "type" | "duration_min" | "distance_km">[] = []): number {
  const counted = activities.reduce((s, a) => s + activitySteps(a), 0);
  const remaining = Math.max(0, (steps || 0) - counted);
  const km = remaining / 1350;
  return Math.round(km * weightKg * 0.5);
}
