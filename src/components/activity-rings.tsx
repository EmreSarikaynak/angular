"use client";
import type { HealthRing } from "@/lib/types";

export const RING_COLORS = { move: "var(--burn)", exercise: "var(--primary)", stand: "var(--water)" };

/**
 * Sağlık halkaları: iç içe üç halka (hareket kalorisi, egzersiz dakikası, ayakta saat).
 * Hedefi aşan halka tam dolu gösterilir; hedefi bilinmeyen değer için halka boş kalır.
 */
export function ActivityRings({ ring, size = 150, label }: { ring: Partial<HealthRing>; size?: number; label: string }) {
  const stroke = size * 0.105;
  const gap = size * 0.02;
  const rows: { value: number | null | undefined; goal: number | null | undefined; color: string }[] = [
    { value: ring.move_kcal, goal: ring.move_goal, color: RING_COLORS.move },
    { value: ring.exercise_min, goal: ring.exercise_goal, color: RING_COLORS.exercise },
    { value: ring.stand_hours, goal: ring.stand_goal, color: RING_COLORS.stand },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" role="img" aria-label={label}>
      {rows.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * radius;
        const ratio = r.value != null && r.goal ? Math.min(1, Math.max(0, r.value / r.goal)) : 0;
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.18} strokeWidth={stroke} />
            {ratio > 0 && <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />}
          </g>
        );
      })}
    </svg>
  );
}

export function RingLegend({ ring, labels }: { ring: Partial<HealthRing>; labels: { move: string; exercise: string; stand: string; min: string; hours: string } }) {
  const row = (color: string, name: string, value: number | null | undefined, goal: number | null | undefined, unit: string) =>
    value == null ? null : (
      <li className="flex items-baseline gap-2">
        <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: color }} />
        <span className="text-xs text-muted">{name}</span>
        <span className="ml-auto text-sm font-semibold" style={{ color }}>
          {value}
          <span className="font-normal text-muted">
            {goal ? `/${goal}` : ""} {unit}
          </span>
        </span>
      </li>
    );
  return (
    <ul className="min-w-0 flex-1 space-y-1.5">
      {row(RING_COLORS.move, labels.move, ring.move_kcal, ring.move_goal, "kcal")}
      {row(RING_COLORS.exercise, labels.exercise, ring.exercise_min, ring.exercise_goal, labels.min)}
      {row(RING_COLORS.stand, labels.stand, ring.stand_hours, ring.stand_goal, labels.hours)}
    </ul>
  );
}
