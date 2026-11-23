"use client";
import { useMemo, useState } from "react";
import { Award, Download, Flame, Trophy } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, PageHeader, Ring, Skeleton } from "@/components/ui";
import { performanceSummaries, type PerfSummary } from "@/lib/bkn/performance";
import { computeStreaks, type BadgeKey } from "@/lib/bkn/streaks";
import { supplementSlots } from "@/lib/bkn/score";
import { dayRows } from "@/lib/stats";
import { performancePdf, performancePng, type PerfTable } from "@/lib/bkn/performance-export";
import { useBody, useRange, useSupplementLogs, useSupplements } from "@/lib/data/hooks";
import { addDays, formatDate, toDateKey } from "@/lib/dates";
import { download } from "@/lib/export";
import { numberFmt } from "@/lib/i18n";

export default function PerformancePage() {
  const { t, lang, profile, toast } = useApp();
  const end = toDateKey();
  const from = addDays(end, -364);
  const range = useRange(from, end);
  const body = useBody();
  const supplements = useSupplements();
  const logs = useSupplementLogs(from, end);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);

  const summaries = useMemo<PerfSummary[] | null>(() => {
    if (!range.data) return null;
    return performanceSummaries(end, { ...range.data, body: body.data ?? [], supplements: supplements.data ?? [], supplementLogs: logs.data ?? [] }, profile);
  }, [range.data, body.data, supplements.data, logs.data, end, profile]);

  const streaks = useMemo(() => {
    if (!range.data) return null;
    const rows = dayRows(from, end, range.data, profile);
    const supps = supplements.data ?? [];
    const perfect = rows.filter((r) => {
      const slots = supplementSlots(supps.filter((x) => !x.created_at || x.created_at.slice(0, 10) <= r.date), logs.data ?? [], r.date);
      return slots.length > 0 && slots.every((x) => x.log);
    }).length;
    return computeStreaks(rows, profile, { activityCount: range.data.activities.length, supplementPerfectDays: perfect, totalEntries: range.data.food.length });
  }, [range.data, supplements.data, logs.data, from, end, profile]);

  const badgeNames: Record<BadgeKey, [string, string]> = {
    first_log: [t("İlk adım"), t("İlk kaydını gir")],
    streak_3: [t("3 günlük seri"), t("Art arda 3 gün kayıt")],
    streak_7: [t("7 günlük seri"), t("Art arda 7 gün kayıt")],
    streak_30: [t("30 günlük seri"), t("Art arda 30 gün kayıt")],
    streak_100: [t("100 günlük seri"), t("Art arda 100 gün kayıt")],
    water_7: [t("Su ustası"), t("Art arda 7 gün su hedefi")],
    protein_7: [t("Protein dostu"), t("7 gün protein hedefi")],
    steps_7: [t("Yürüyüşçü"), t("7 gün adım hedefi")],
    active_10: [t("Hareketli"), t("10 aktivite kaydı")],
    supplements_7: [t("Düzenli"), t("7 gün eksiksiz takviye")],
    logs_100: [t("Günlük tutkunu"), t("100 yiyecek kaydı")],
    weight_first_kg: [t("İlk kilo"), t("Hedefe doğru ilk 1 kg")],
  };

  const names: Record<string, string> = { w1: t("Haftalık"), w3: t("3 haftalık"), m1: t("Aylık"), m3: t("3 aylık"), y1: t("Yıllık") };
  const dash = "–";
  const v = (x: number | null, unit = "", d = 0) => (x == null ? dash : `${nf(x, d)}${unit}`);
  const p = (x: number | null) => (x == null ? dash : `%${x}`);

  const table = useMemo<PerfTable | null>(() => {
    if (!summaries) return null;
    const row = (name: string, pick: (s: PerfSummary) => string) => [name, ...summaries.map(pick)];
    return {
      title: t("Performans özeti"),
      tagline: t("Bugün kendin için ne yaptın?"),
      subtitle: `${[profile?.first_name, profile?.last_name].filter(Boolean).join(" ")} · ${formatDate(end, lang, { day: "numeric", month: "long", year: "numeric" })}`,
      footer: t("Değerler kullanıcı kayıtlarına ve tahminlere dayanır; tıbbi değerlendirme yerine geçmez. · BKN"),
      columns: summaries.map((s) => names[s.key]),
      scores: summaries.map((s) => s.bknScore),
      scoreLabel: t("BKN skoru"),
      rows: [
        row(t("Kayıt girilen gün"), (s) => `${s.loggedDays} / ${s.days}`),
        row(t("Ortalama kalori"), (s) => v(s.avgKcal, " kcal")),
        row(t("Kalori hedefine uyum"), (s) => p(s.calorieAdherence)),
        row(t("Ortalama protein"), (s) => v(s.avgProtein, " g")),
        row(t("Protein hedefine uyum"), (s) => p(s.proteinAdherence)),
        row(t("Ortalama su"), (s) => v(s.avgWater, " ml")),
        row(t("Su hedefine uyum"), (s) => p(s.waterAdherence)),
        row(t("Takviye düzeni"), (s) => p(s.supplementAdherence)),
        row(t("Ortalama adım"), (s) => v(s.avgSteps)),
        row(t("Aktivite süresi"), (s) => (s.activitySessions ? `${nf(s.activeMinutes)} ${t("dk")}` : dash)),
        row(t("Yakılan kalori"), (s) => (s.burnedKcal ? `${nf(s.burnedKcal)} kcal` : dash)),
        row(t("Ortalama uyku"), (s) => v(s.avgSleep, ` ${t("saat")}`, 1)),
        row(t("Kilo değişimi"), (s) => (s.weightChange == null ? dash : `${s.weightChange > 0 ? "+" : ""}${nf(s.weightChange, 1)} kg`)),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, lang, profile?.first_name, profile?.last_name, end]);

  const hasData = !!summaries && summaries.at(-1)!.loggedDays + (summaries.at(-1)!.avgWater ?? 0) + summaries.at(-1)!.burnedKcal > 0;

  async function save(kind: "pdf" | "png") {
    if (!table) return;
    setBusy(kind);
    try {
      download(`bkn-performans_${end}.${kind}`, kind === "pdf" ? await performancePdf(table) : await performancePng(table));
    } catch {
      toast(t("Dışa aktarılamadı. Lütfen tekrar deneyin."), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title={t("Performans özeti")} subtitle={t("Haftalık, 3 haftalık, aylık, 3 aylık ve yıllık bir arada")} />
      {!summaries || !table ? (
        <Skeleton className="h-80" />
      ) : !hasData ? (
        <Card>
          <Empty icon={<Trophy size={22} />} title={t("Henüz özetlenecek kayıt yok")} text={t("Kayıt ekledikçe dönemsel performansınız burada oluşur.")} />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="text-sm font-semibold">{t("BKN skoru")}</p>
            <p className="text-xs text-muted">{t("Öğün, protein, su, hareket, takviye ve uyku hedeflerinizi ne ölçüde tamamladığınızın 100 üzerinden ortalaması.")}</p>
            <div className="mt-4 grid grid-cols-5 gap-1">
              {summaries.map((s) => (
                <div key={s.key} className="flex flex-col items-center gap-1.5">
                  <Ring value={s.bknScore ?? 0} max={100} size={58} stroke={7} overColor="var(--primary)" label={`${names[s.key]}: ${s.bknScore ?? 0} / 100`}>
                    <span className="text-sm font-bold">{s.bknScore ?? dash}</span>
                  </Ring>
                  <span className="text-center text-[11px] font-medium text-muted">{names[s.key]}</span>
                </div>
              ))}
            </div>
          </Card>

          {streaks && (
            <Card>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Flame size={18} className="text-burn" />
                  {t("Güncel seri: {n} gün", { n: streaks.current })}
                </p>
                <p className="text-sm text-muted">{t("En uzun seri: {n} gün", { n: streaks.longest })}</p>
                <p className="text-sm text-muted">{t("Su hedefi serisi: {n} gün", { n: streaks.waterCurrent })}</p>
              </div>
              <p className="mb-3 mt-4 flex items-center gap-2 text-sm font-semibold">
                <Award size={16} className="text-muted" />
                {t("Rozetler")} ({streaks.badges.filter((b) => b.earned).length}/{streaks.badges.length})
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {streaks.badges.map((b) => (
                  <li key={b.key} data-earned={b.earned} className={`rounded-xl border p-2.5 ${b.earned ? "border-primary bg-primary-soft" : "border-border"}`}>
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${b.earned ? "text-primary" : "text-muted"}`}>
                      <Award size={14} />
                      {badgeNames[b.key][0]}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{badgeNames[b.key][1]}</p>
                    {!b.earned && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-muted" style={{ width: `${Math.round(b.progress * 100)}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">{t("Seri ve rozetler son 365 günün kayıtlarından hesaplanır.")}</p>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-primary">
                  <th className="sticky left-0 bg-surface px-4 py-3 text-left font-semibold text-muted">{t("Ölçüt")}</th>
                  {table.columns.map((c) => (
                    <th key={c} className="px-3 py-3 text-right font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {table.rows.map((r) => (
                  <tr key={r[0]}>
                    <th scope="row" className="sticky left-0 bg-surface px-4 py-2.5 text-left font-normal text-muted">
                      {r[0]}
                    </th>
                    {r.slice(1).map((c, i) => (
                      <td key={i} className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="no-print">
            <h2 className="mb-1 font-semibold">{t("Özeti indir")}</h2>
            <p className="mb-3 text-xs text-muted">{t("PDF olarak saklayın ya da PNG olarak paylaşın.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy === "pdf"} onClick={() => save("pdf")}>
                <Download size={16} />
                PDF
              </Button>
              <Button variant="secondary" loading={busy === "png"} onClick={() => save("png")}>
                <Download size={16} />
                PNG
              </Button>
            </div>
          </Card>
          <p className="text-xs text-muted">{t("Her dönem bugünde biter. Ortalamalar yalnızca kayıt girilen günlerden hesaplanır.")}</p>
        </div>
      )}
    </div>
  );
}
