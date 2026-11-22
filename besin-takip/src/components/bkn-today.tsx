"use client";
import Link from "next/link";
import { Check, ChevronRight, Lightbulb } from "lucide-react";
import { useApp } from "./app-provider";
import { ActivityRings, RingLegend } from "./activity-rings";
import { Card, Ring, cx } from "./ui";
import { bknDay, supplementSlots, type BknItemKey } from "@/lib/bkn/score";
import { proteinGap } from "@/lib/bkn/insights";
import { useSupplementLogs, useSupplements, type RangeData } from "@/lib/data/hooks";
import { upsertRow, uuid } from "@/lib/data/store";
import type { DaySummary } from "@/lib/day";

/** Ana sayfa: günün öz bakım özeti, bekleyen takviyeler, sağlık halkaları ve protein önerisi. */
export function BknToday({ date, summary, data }: { date: string; summary: DaySummary; data: RangeData }) {
  const { t, profile, toast } = useApp();
  const supplements = useSupplements();
  const logs = useSupplementLogs(date, date);
  const slots = supplementSlots(supplements.data ?? [], logs.data ?? [], date);
  const meals = new Set(data.food.filter((f) => f.entry_date === date && f.meal !== "drink").map((f) => f.meal)).size;
  const exerciseMin = data.activities.filter((a) => a.entry_date === date).reduce((s, a) => s + a.duration_min, 0);
  const daily = data.daily.find((d) => d.entry_date === date);
  const ring = data.rings.find((r) => r.entry_date === date);
  const { items, score } = bknDay(summary, profile, { mealsLogged: meals, daily, slots, exerciseMin: Math.max(exerciseMin, ring?.exercise_min ?? 0) });
  const gap = proteinGap(summary.intake.protein_g, profile?.protein_target_g, new Date().getHours());
  const pending = slots.filter((s) => !s.log);

  const names: Record<BknItemKey, [string, string]> = {
    meals: [t("Öğünler"), "/diary"],
    protein: [t("Protein"), "/coach"],
    water: [t("Su"), "/water"],
    move: [t("Hareket"), "/activity"],
    supplements: [t("Takviye"), "/supplements"],
    sleep: [t("Uyku"), "/wellbeing"],
  };

  async function take(slot: (typeof slots)[number]) {
    try {
      await upsertRow("supplement_logs", { id: uuid(), supplement_id: slot.supplement.id, entry_date: date, time_slot: slot.time, taken_at: new Date().toISOString() });
      toast(t("Harika! {name} tamamlandı.", { name: slot.supplement.name }));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center gap-4">
          <Ring value={score} max={100} size={84} stroke={9} overColor="var(--primary)" label={t("BKN skoru: {n} / 100", { n: score })}>
            <span className="text-xl font-bold">{score}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("Bugün kendin için ne yaptın?")}</p>
            <p className="text-xs text-muted">{score >= 85 ? t("Harika bir gün. Böyle devam!") : score >= 50 ? t("İyi gidiyorsun; birkaç küçük adım kaldı.") : t("Küçük bir adımla başla: bir bardak su ya da bir öğün kaydı.")}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((i) => (
            <Link
              key={i.key}
              href={names[i.key][1]}
              className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", i.done ? "border-primary bg-primary-soft text-primary" : "border-border text-muted")}
            >
              {i.done ? <Check size={13} /> : <span className="tabular-nums">{Math.round(i.progress * 100)}%</span>}
              {names[i.key][0]}
            </Link>
          ))}
        </div>
        {gap.behind && (
          <Link href="/coach" className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary">
            <Lightbulb size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">{t("Protein hedefine {n} g kaldı. Sana uygun tariflere bak.", { n: gap.remaining })}</span>
            <ChevronRight size={16} />
          </Link>
        )}
      </Card>

      <div className="space-y-4">
        {slots.length > 0 && (
          <Card>
            <Link href="/supplements" className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("Takviyeler")}</p>
              <span className="flex items-center gap-1 text-xs text-muted">
                {slots.length - pending.length} / {slots.length}
                <ChevronRight size={16} />
              </span>
            </Link>
            {pending.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-primary">
                <Check size={16} />
                {t("Bugünün tüm takviyeleri tamam.")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {pending.slice(0, 3).map((slot) => (
                  <li key={`${slot.supplement.id}-${slot.time}`} className="flex items-center gap-2.5">
                    <button type="button" aria-label={t("{name} alındı olarak işaretle", { name: slot.supplement.name })} onClick={() => take(slot)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-border text-transparent hover:border-primary hover:text-primary">
                      <Check size={15} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {slot.supplement.name}
                      <span className="text-muted">
                        {" "}
                        · {slot.time}
                        {slot.supplement.dose ? ` · ${slot.supplement.dose}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <Card>
          <Link href="/rings" className="flex items-center gap-4">
            {ring ? (
              <>
                <ActivityRings ring={ring} size={84} label={t("Sağlık halkaları")} />
                <RingLegend ring={ring} labels={{ move: t("Hareket"), exercise: t("Egzersiz"), stand: t("Ayakta"), min: t("dk"), hours: t("saat") }} />
              </>
            ) : (
              <>
                <ActivityRings ring={{}} size={56} label={t("Sağlık halkaları")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t("Sağlık halkaları")}</p>
                  <p className="text-xs text-muted">{t("Saatinizin ekran görüntüsünü yükleyin, günlüğe işleyelim.")}</p>
                </div>
              </>
            )}
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
