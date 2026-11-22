"use client";
import { useMemo, useState } from "react";
import { Download, Trophy } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, PageHeader, Ring, Skeleton } from "@/components/ui";
import { performanceSummaries, type PerfSummary } from "@/lib/bkn/performance";
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
