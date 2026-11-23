"use client";
import type { HealthRing } from "@/lib/types";

/**
 * Apple Aktivite halkalarının renkleri: Hareket (kırmızı-pembe), Egzersiz (limon yeşili), Ayakta (turkuaz).
 * Her halka başlangıçtan uca doğru koyudan açığa geçen bir degrade ile çizilir.
 */
export const RING_COLORS = { move: "#fa114f", exercise: "#92e82a", stand: "#00d9e8" };
const GRADIENTS = {
  move: ["#fa114f", "#ff4f95"],
  exercise: ["#8be22b", "#cfff4a"],
  stand: ["#00c4e6", "#1ef7ee"],
} as const;

type Kind = "move" | "exercise" | "stand";

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
};

/** Saat 12'den saat yönünde, açı radyan (0 = tepe). */
const pt = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** Halkanın başlangıcındaki ok simgesi (Hareket →, Egzersiz »-benzeri, Ayakta ↑). */
function Glyph({ kind, x, y, s }: { kind: Kind; x: number; y: number; s: number }) {
  const w = s * 0.2;
  const common = { fill: "none", stroke: "#000", strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "stand") {
    return (
      <g {...common} transform={`translate(${x} ${y})`}>
        <path d={`M0 ${s * 0.42}V${-s * 0.4}M${-s * 0.32} ${-s * 0.08}L0 ${-s * 0.42}L${s * 0.32} ${-s * 0.08}`} />
      </g>
    );
  }
  if (kind === "exercise") {
    return (
      <g {...common} transform={`translate(${x} ${y})`}>
        <path d={`M${-s * 0.38} ${-s * 0.3}L${-s * 0.08} 0L${-s * 0.38} ${s * 0.3}M${s * 0.05} ${-s * 0.3}L${s * 0.35} 0L${s * 0.05} ${s * 0.3}`} />
      </g>
    );
  }
  return (
    <g {...common} transform={`translate(${x} ${y})`}>
      <path d={`M${-s * 0.42} 0H${s * 0.4}M${s * 0.08} ${-s * 0.32}L${s * 0.42} 0L${s * 0.08} ${s * 0.32}`} />
    </g>
  );
}

function Ring({ kind, cx, cy, r, stroke, ratio }: { kind: Kind; cx: number; cy: number; r: number; stroke: number; ratio: number }) {
  const [c0, c1] = GRADIENTS[kind];
  const sweep = Math.min(ratio, 1) * 2 * Math.PI;
  const segs = Math.max(2, Math.ceil(sweep / (Math.PI / 72)));
  const base: React.ReactNode[] = [];
  // Degrade, çok sayıda kısa yayın renk geçişiyle çizilir (SVG'de açısal degrade yok).
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * sweep;
    const a1 = ((i + 1) / segs) * sweep + (i < segs - 1 ? 0.012 : 0);
    base.push(<path key={i} d={arc(cx, cy, r, a0, a1)} stroke={mix(c0, c1, (i + 0.5) / segs)} strokeWidth={stroke} fill="none" />);
  }
  // İkinci tur (%100'ün üstü): ilk turun üstüne çizilir, ucu gölgelidir.
  const extra = Math.min(Math.max(ratio - 1, 0), 1) * 2 * Math.PI;
  const extraSegs = Math.max(2, Math.ceil(extra / (Math.PI / 72)));
  const headA = ratio > 1 ? extra : sweep;
  const [hx, hy] = pt(cx, cy, r, headA);
  const [sx, sy] = pt(cx, cy, r, 0);
  const filterId = `sh-${kind}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c0} strokeOpacity={0.24} strokeWidth={stroke} />
      {ratio > 0 && (
        <>
          <circle cx={sx} cy={sy} r={stroke / 2} fill={c0} />
          {base}
          {ratio > 1 && extra > 0.02 && (
            <>
              {Array.from({ length: extraSegs }, (_, i) => (
                <path key={`x${i}`} d={arc(cx, cy, r, (i / extraSegs) * extra, ((i + 1) / extraSegs) * extra + (i < extraSegs - 1 ? 0.012 : 0))} stroke={mix(c0, c1, (i + 0.5) / extraSegs)} strokeWidth={stroke} fill="none" />
              ))}
            </>
          )}
          <circle cx={hx} cy={hy} r={stroke / 2} fill={c1} filter={ratio > 1 ? `url(#${filterId})` : undefined} />
        </>
      )}
    </g>
  );
}

/**
 * Sağlık halkaları: Apple Aktivite halkaları gibi siyah zemin üzerinde iç içe üç halka (Hareket, Egzersiz, Ayakta).
 * Halkalar saat 12'den başlar, uçları yuvarlaktır, %100'ü aşan halka ikinci tura geçer; hedefi bilinmeyen halka boş kalır.
 */
export function ActivityRings({ ring, size = 150, label }: { ring: Partial<HealthRing>; size?: number; label: string }) {
  // Halka grubu, Apple Aktivite halkalarındaki oranla: kalınlık ≈ %10,5, boşluk ≈ %1,2, orta delik ≈ %16 (çapa göre).
  const D = size * 0.82;
  const pad = (size - D) / 2;
  const stroke = D * 0.105;
  const gap = D * 0.012;
  const c = size / 2;
  const rows: { kind: Kind; value: number | null | undefined; goal: number | null | undefined }[] = [
    { kind: "move", value: ring.move_kcal, goal: ring.move_goal },
    { kind: "exercise", value: ring.exercise_min, goal: ring.exercise_goal },
    { kind: "stand", value: ring.stand_hours, goal: ring.stand_goal },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={label}>
      <defs>
        {(["move", "exercise", "stand"] as Kind[]).map((k) => (
          <filter key={k} id={`sh-${k}`} x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx={size * 0.012} dy={0} stdDeviation={size * 0.012} floodColor="#000" floodOpacity="0.55" />
          </filter>
        ))}
      </defs>
      <rect width={size} height={size} rx={size * 0.225} fill="#000" />
      {rows.map((r, i) => {
        const radius = size / 2 - pad - stroke / 2 - i * (stroke + gap);
        const ratio = r.value != null && r.goal ? Math.min(2, Math.max(0, r.value / r.goal)) : 0;
        const [sx, sy] = pt(c, c, radius, 0);
        return (
          <g key={r.kind}>
            <Ring kind={r.kind} cx={c} cy={c} r={radius} stroke={stroke} ratio={ratio} />
            <Glyph kind={r.kind} x={sx} y={sy} s={stroke * 0.72} />
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
