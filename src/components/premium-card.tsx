"use client";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { useApp } from "./app-provider";
import { Card } from "./ui";

/** Profil sayfasındaki Premium kartı: durum ve günlük yapay zekâ kullanımı. */
export function PremiumCard() {
  const { t, config } = useApp();
  const premium = !!config?.premium;
  return (
    <Link href="/premium" className="block">
      <Card className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Crown size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{premium ? t("BKNY Premium: aktif") : t("BKNY Premium")}</p>
          <p className="truncate text-xs text-muted">
            {config ? t("Bugünkü yapay zekâ kullanımın: {u} / {l}", { u: config.quota.used, l: config.quota.limit }) : t("Daha yüksek yapay zekâ limiti")}
          </p>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </Card>
    </Link>
  );
}
