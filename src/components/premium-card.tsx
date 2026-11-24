"use client";
import Link from "next/link";
import { ChevronRight, Crown, Sparkles } from "lucide-react";
import { useApp } from "./app-provider";

/** Profilin en üstündeki Premium alanı: üyeyse rozet, değilse "Premium üye ol" daveti. */
export function PremiumCard() {
  const { t, config } = useApp();
  if (!config) return null;
  const premium = !!config.premium;
  return (
    <Link
      href="/premium"
      className={`relative block overflow-hidden rounded-2xl p-4 text-white shadow-md transition active:scale-[.99] ${premium ? "bg-gradient-to-r from-emerald-600 via-primary to-teal-500" : "bg-gradient-to-r from-primary to-emerald-500"}`}
    >
      <span aria-hidden className="bt-shimmer pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">{premium ? <Crown size={22} /> : <Sparkles size={22} />}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold">
            {config.owner ? t("Kurucu · Premium") : premium ? t("Premium üye") : t("Premium üye ol")}
            {premium && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{config.owner ? t("Sonsuza dek") : t("Aktif")}</span>}
          </p>
          <p className="truncate text-xs text-white/85">
            {premium ? t("Bugünkü yapay zekâ kullanımın: {u} / {l}", { u: config.quota.used, l: config.quota.limit }) : t("Çok daha yüksek yapay zekâ limiti")}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-white/80" />
      </div>
    </Link>
  );
}
