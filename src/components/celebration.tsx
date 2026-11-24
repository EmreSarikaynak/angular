"use client";
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { useApp } from "./app-provider";
import { Button } from "./ui";

const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa", "#f87171"];

/** Satın alma sonrası kutlama: konfeti yağmuru ve "Premium'a hoş geldin" kartı. */
export function Celebration({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 100) / 80,
        dur: 2.6 + ((i * 29) % 15) / 10,
        size: 6 + ((i * 17) % 7),
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    [],
  );
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={t("Premium'a hoş geldin!")}>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="bt-confetti absolute top-0 block"
            style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? "9999px" : "2px", animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          />
        ))}
      </div>
      <div className="bt-pop relative w-full max-w-sm rounded-3xl border border-border bg-surface p-6 text-center shadow-2xl">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
          <Crown size={32} />
        </span>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight">{t("Premium'a hoş geldin!")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Aboneliğin etkinleşti. Daha yüksek yapay zekâ limitinin keyfini çıkar.")}</p>
        <Button size="lg" className="mt-5 w-full" onClick={onClose}>
          {t("Harika!")}
        </Button>
      </div>
    </div>
  );
}
