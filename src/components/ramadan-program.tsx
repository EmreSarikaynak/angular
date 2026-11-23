"use client";
import { Moon } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Card } from "@/components/ui";
import { ramadanProgram, waterPlan } from "@/lib/bkn/ramadan";

/** Ramazan modundaki kullanıcı için günlük hedeflerden türetilen iftar / ara öğün / sahur programı. */
export function RamadanProgram() {
  const { profile, t } = useApp();
  if (!profile?.ramadan_mode || !profile.kcal_target || !profile.protein_target_g) return null;
  const slots = ramadanProgram(profile.kcal_target, profile.protein_target_g, profile.iftar_time, profile.sahur_time);
  const water = waterPlan(profile.water_target_ml ?? 2000, profile.iftar_time, profile.sahur_time);
  const label = { iftar: t("İftar"), snack: t("Ara öğün"), sahur: t("Sahur") };
  const tip = {
    iftar: t("Su ve 2-3 hurma ile aç, ardından çorba ve proteinli ana yemek (tavuk, balık, et, baklagil) ye."),
    snack: t("İftardan yaklaşık 2 saat sonra yoğurt, kefir, yumurta veya peynir ile proteini tamamla."),
    sahur: t("Yumurta, peynir, yoğurt ve tam tahıl tercih et; tuzlu ve çok şekerli yiyecekler gün içinde susatır."),
  };
  return (
    <Card className="space-y-3 border-primary/30">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
          <Moon size={16} />
        </span>
        <h2 className="font-semibold">{t("Ramazan beslenme programı")}</h2>
      </div>
      <p className="text-xs text-muted">{t("Günlük kalori ve protein hedefin, yeme penceresine üç öğün olarak bölündü.")}</p>
      <ul className="space-y-2.5">
        {slots.map((s) => (
          <li key={s.key} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {label[s.key]} <span className="font-normal text-muted">· {s.time}</span>
              </p>
              <p className="text-sm tabular-nums">{t("~{kcal} kcal · {p} g protein", { kcal: s.kcal, p: s.protein_g })}</p>
            </div>
            <p className="mt-1 text-xs text-muted">{tip[s.key]}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm">{t("Su hedefini iftar ile sahur arasında yudum yudum tamamla: saatte yaklaşık {n} ml.", { n: water.perHourMl })}</p>
      <p className="text-xs text-muted">{t("Bu program hedeflerinin bölünmesidir, tıbbi öneri değildir. Kronik hastalığın varsa veya hamile/emziriyorsan oruç ve beslenme için hekimine danış.")}</p>
    </Card>
  );
}
