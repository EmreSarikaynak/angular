"use client";
import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { BarSeries, Donut, LineSeries } from "@/components/charts";
import { Bar, Button, Card, Empty, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui";
import { useBody, useRange } from "@/lib/data/hooks";
import { addDays, formatDate, formatShort, fromDateKey, toDateKey } from "@/lib/dates";
import { download, entriesCsv, reportPdf, summaryCsv } from "@/lib/export";
import { numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, MEAL_LABELS, label } from "@/lib/i18n/labels";
import { standardDrinks } from "@/lib/nutrition/drinks";
import { activityStats, adherence, avg, dayRows, monthlyBuckets, periodRange, relations, topFoods, type Relation } from "@/lib/stats";
import { MEALS } from "@/lib/types";

type Period = "day" | "week" | "month" | "year";

export default function StatsPage() {
  const { t, lang, profile, toast } = useApp();
  const [period, setPeriod] = useState<Period>("week");
  const [end, setEnd] = useState(toDateKey());
  const { from, to } = periodRange(period, end);
  const range = useRange(from, to);
  const body = useBody();
  const [exporting, setExporting] = useState<string | null>(null);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const step = { day: 1, week: 7, month: 30, year: 365 }[period];

  const model = useMemo(() => {
    const data = range.data ?? { food: [], water: [], activities: [], daily: [], rings: [] };
    const rows = dayRows(from, to, data, profile);
    const logged = rows.filter((r) => r.logged);
    const months = period === "year" ? monthlyBuckets(rows) : null;
    const monthLabel = (k: string) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", { month: "short" }).format(fromDateKey(`${k}-01`));
    const dayLabel = (d: string) => (period === "week" ? new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "tr-TR", { weekday: "short" }).format(fromDateKey(d)) : formatShort(d, lang));
    const series = (pick: (r: (typeof rows)[number]) => number, pickMonth: (m: NonNullable<typeof months>[number]) => number) =>
      months ? months.map((m) => ({ label: monthLabel(m.key), value: pickMonth(m) })) : rows.map((r) => ({ label: dayLabel(r.date), value: pick(r) }));

    const totalP = logged.reduce((s, r) => s + r.intake.protein_g, 0) * 4;
    const totalC = logged.reduce((s, r) => s + r.intake.carbs_g, 0) * 4;
    const totalF = logged.reduce((s, r) => s + r.intake.fat_g, 0) * 9;
    const totalA = logged.reduce((s, r) => s + r.intake.alcohol_g, 0) * 7;
    const macroSum = totalP + totalC + totalF + totalA;
    const weights = (body.data ?? []).filter((b) => b.weight_kg != null && b.entry_date >= from && b.entry_date <= to);
    const alcoholTotal = rows.reduce((s, r) => s + r.intake.alcohol_g, 0);
    const drinkEntries = data.food.filter((f) => f.meal === "drink");

    return {
      data,
      rows,
      logged,
      kcalSeries: series((r) => Math.round(r.intake.kcal), (m) => m.kcal),
      waterSeries: series((r) => r.water_ml, (m) => m.water_ml),
      burnSeries: series((r) => r.burned_kcal, (m) => m.burned_kcal),
      alcoholSeries: series((r) => Math.round(r.intake.alcohol_g * 10) / 10, (m) => m.alcohol_g),
      mealSeries: MEALS.map((m) => ({ label: label(MEAL_LABELS, m, lang), value: Math.round(data.food.filter((f) => f.meal === m).reduce((s, f) => s + f.kcal, 0)) })),
      macros: macroSum
        ? [
            { name: t("Protein"), value: (totalP / macroSum) * 100, color: "var(--protein)" },
            { name: t("Karbonhidrat"), value: (totalC / macroSum) * 100, color: "var(--carbs)" },
            { name: t("Yağ"), value: (totalF / macroSum) * 100, color: "var(--fat)" },
            ...(totalA > 0 ? [{ name: t("Alkol"), value: (totalA / macroSum) * 100, color: "var(--muted)" }] : []),
          ]
        : [],
      avgKcal: avg(logged.map((r) => r.intake.kcal)),
      avgProtein: avg(logged.map((r) => r.intake.protein_g)),
      avgCarbs: avg(logged.map((r) => r.intake.carbs_g)),
      avgFat: avg(logged.map((r) => r.intake.fat_g)),
      avgSugar: avg(logged.map((r) => r.intake.sugar_g)),
      avgFiber: avg(logged.map((r) => r.intake.fiber_g)),
      avgSalt: avg(logged.map((r) => r.intake.salt_g)),
      avgWater: avg(rows.filter((r) => r.water_ml > 0).map((r) => r.water_ml)),
      weights,
      weightSeries: weights.map((b) => ({ label: formatShort(b.entry_date, lang), value: b.weight_kg })),
      act: activityStats(data.activities),
      alcoholTotal,
      drinkKcal: drinkEntries.reduce((s, f) => s + f.kcal, 0),
      alcoholDays: rows.filter((r) => r.intake.alcohol_g > 0).length,
      top: topFoods(data.food.filter((f) => f.meal !== "drink")),
      adh: adherence(rows, profile),
      rel: relations(rows, body.data ?? []),
    };
  }, [range.data, body.data, from, to, period, profile, lang, t]);

  const hasAny = model.data.food.length + model.data.water.length + model.data.activities.length + model.data.daily.length > 0;
  const periodTitle = period === "day" ? formatDate(to, lang) : `${formatShort(from, lang)} – ${formatShort(to, lang)}`;

  function relationText(r: Relation): string | null {
    const strength = (v: number) => (Math.abs(v) >= 0.5 ? t("belirgin") : Math.abs(v) >= 0.25 ? t("orta düzeyde") : t("zayıf"));
    if (r.key === "sleep_kcal") {
      if (r.n < 5 || !r.a || !r.b) return null;
      return t("7 saatten az uyuduğunuz günlerde ortalama {a} kcal, 7 saat ve üzeri uyuduğunuz günlerde {b} kcal aldınız.", { a: nf(r.a), b: nf(r.b) });
    }
    if (r.key === "exercise_mood") {
      if (!r.n || r.a == null || r.b == null) return null;
      return t("Egzersiz yaptığınız günlerde ruh hali ortalamanız {a}/5, yapmadığınız günlerde {b}/5.", { a: nf(r.a, 1), b: nf(r.b, 1) });
    }
    if (r.r == null) return null;
    const dir = r.r > 0;
    const s = strength(r.r);
    if (r.key === "sleep_energy") return dir ? t("Daha uzun uyuduğunuz günlerde enerji seviyeniz daha yüksek ({s} ilişki, r = {r}).", { s, r: r.r }) : t("Uyku süreniz ile enerji seviyeniz arasında ters yönlü {s} bir ilişki var (r = {r}).", { s, r: r.r });
    if (r.key === "sleep_mood") return dir ? t("Daha uzun uyuduğunuz günlerde ruh haliniz daha iyi ({s} ilişki, r = {r}).", { s, r: r.r }) : t("Uyku süreniz ile ruh haliniz arasında ters yönlü {s} bir ilişki var (r = {r}).", { s, r: r.r });
    if (r.key === "stress_kcal") return dir ? t("Stresinizin yüksek olduğu günlerde daha fazla kalori alıyorsunuz ({s} ilişki, r = {r}).", { s, r: r.r }) : t("Stresinizin yüksek olduğu günlerde daha az kalori alıyorsunuz ({s} ilişki, r = {r}).", { s, r: r.r });
    if (r.key === "kcal_weight") return dir ? t("Ortalama kalorinizin yüksek olduğu dönemlerde kilonuz artma eğiliminde ({s} ilişki, r = {r}).", { s, r: r.r }) : t("Kalori alımınız ile kilo değişiminiz arasında beklenen yönde bir ilişki görünmüyor (r = {r}).", { r: r.r });
    return null;
  }
  const relTexts = model.rel.map(relationText).filter((x): x is string => !!x);

  async function exportFile(kind: "pdf" | "csv" | "entries") {
    setExporting(kind);
    try {
      const stamp = `${from}_${to}`;
      const h = {
        date: t("Tarih"), time: t("Saat"), meal: t("Öğün"), name: t("Yiyecek"), amount: t("Miktar (g/ml)"), kcal: t("Kalori (kcal)"), protein: t("Protein (g)"), carbs: t("Karbonhidrat (g)"), fat: t("Yağ (g)"),
        sugar: t("Şeker (g)"), fiber: t("Lif (g)"), salt: t("Tuz (g)"), alcohol: t("Alkol (g)"), water: t("Su (ml)"), burned: t("Yakılan (kcal)"), steps: t("Adım"), sleep: t("Uyku (saat)"),
        sleepQuality: t("Uyku kalitesi"), mood: t("Ruh hali"), energy: t("Enerji"), stress: t("Stres"), weight: t("Kilo (kg)"), source: t("Kaynak"), estimated: t("Tahmini"), yes: t("Evet"), no: t("Hayır"),
      };
      if (kind === "csv") download(`bkn-ozet_${stamp}.csv`, summaryCsv(model.rows, body.data ?? [], h));
      else if (kind === "entries") download(`bkn-kayitlar_${stamp}.csv`, entriesCsv(model.data.food, h, (m) => label(MEAL_LABELS, m, lang)));
      else {
        const pctText = (v: number | null) => (v == null ? "–" : `%${v}`);
        const blob = await reportPdf({
          title: t("BKN Raporu"),
          subtitle: `${[profile?.first_name, profile?.last_name].filter(Boolean).join(" ")} · ${periodTitle}`,
          generated: t("Oluşturulma: {d}", { d: new Date().toLocaleString(lang === "en" ? "en-GB" : "tr-TR") }),
          summary: [
            [t("Kayıt girilen gün"), `${model.adh.loggedDays} / ${model.adh.totalDays}`],
            [t("Ortalama kalori"), `${nf(model.avgKcal)} kcal (${t("hedef")} ${profile?.kcal_target ?? "–"})`],
            [t("Ortalama protein / karbonhidrat / yağ"), `${nf(model.avgProtein)} g / ${nf(model.avgCarbs)} g / ${nf(model.avgFat)} g`],
            [t("Ortalama şeker / lif / tuz"), `${nf(model.avgSugar)} g / ${nf(model.avgFiber)} g / ${nf(model.avgSalt, 1)} g`],
            [t("Ortalama su"), `${nf(model.avgWater)} ml (${t("hedef")} ${profile?.water_target_ml ?? "–"})`],
            [t("Aktivite"), `${model.act.sessions} ${t("seans")} · ${nf(model.act.minutes)} ${t("dk")} · ${nf(model.act.kcal)} kcal`],
            [t("Saf alkol"), `${nf(model.alcoholTotal, 1)} g (${nf(standardDrinks(model.alcoholTotal), 1)} ${t("standart içki")})`],
            [t("Kilo"), model.weights.length ? `${nf(model.weights[0].weight_kg!, 1)} → ${nf(model.weights.at(-1)!.weight_kg!, 1)} kg` : "–"],
          ],
          adherenceTitle: t("Hedeflere uyum"),
          adherence: [
            [t("Kalori (hedefin ±%10'u)"), pctText(model.adh.calories)],
            [t("Protein"), pctText(model.adh.protein)],
            [t("Su"), pctText(model.adh.water)],
            [t("Adım"), pctText(model.adh.steps)],
          ],
          topTitle: t("En sık tüketilen yiyecekler"),
          topHead: [t("Yiyecek"), t("Kez"), t("Toplam kcal")],
          top: model.top.byCount.map((f) => [f.name, f.count, Math.round(f.kcal)]),
          dailyTitle: t("Günlük döküm"),
          dailyHead: [t("Tarih"), "kcal", "P", "K", "Y", t("Su (ml)"), t("Yakılan"), t("Adım")],
          daily: model.rows.filter((r) => r.logged || r.water_ml > 0 || r.burned_kcal > 0).map((r) => [r.date, Math.round(r.intake.kcal), Math.round(r.intake.protein_g), Math.round(r.intake.carbs_g), Math.round(r.intake.fat_g), r.water_ml, r.burned_kcal, r.steps || ""]),
          disclaimer: t("Bu rapordaki değerler kullanıcı kayıtlarına ve tahminlere dayanır; tıbbi değerlendirme yerine geçmez."),
        });
        download(`bkn-rapor_${stamp}.pdf`, blob);
      }
    } catch {
      toast(t("Dışa aktarılamadı. Lütfen tekrar deneyin."), "error");
    } finally {
      setExporting(null);
    }
  }

  const adhRow = (name: string, v: number | null) => (
    <div key={name}>
      <div className="mb-1 flex justify-between text-sm">
        <span>{name}</span>
        <span className="font-semibold">{v == null ? "–" : `%${v}`}</span>
      </div>
      <Bar value={v ?? 0} max={100} />
    </div>
  );

  return (
    <div>
      <PageHeader title={t("İstatistikler")} subtitle={t("Raporlar ve hedef uyumu")} />
      <Segmented<Period>
        className="no-print mb-3"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "day", label: t("Günlük") },
          { value: "week", label: t("Haftalık") },
          { value: "month", label: t("Aylık") },
          { value: "year", label: t("Yıllık") },
        ]}
      />
      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface p-1.5">
        <button type="button" onClick={() => setEnd(addDays(end, -step))} aria-label={t("Önceki dönem")} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold">{periodTitle}</span>
        <button type="button" onClick={() => setEnd(addDays(end, step) > toDateKey() ? toDateKey() : addDays(end, step))} disabled={end >= toDateKey()} aria-label={t("Sonraki dönem")} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-surface-2 disabled:opacity-30">
          <ChevronRight size={20} />
        </button>
      </div>

      {range.loading && !range.data ? (
        <Skeleton className="h-72" />
      ) : !hasAny ? (
        <Card>
          <Empty icon={<BarChart3 size={22} />} title={t("Bu dönem için kayıt yok")} text={t("Kayıt ekledikçe grafikler ve raporlar burada oluşur.")} />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={period === "day" ? t("Kalori") : t("Ortalama kalori")} value={nf(model.avgKcal)} unit="kcal" />
              <Stat label={period === "day" ? t("Su") : t("Ortalama su")} value={nf(model.avgWater)} unit="ml" color="var(--water)" />
              <Stat label={t("Sporla yakılan")} value={nf(model.rows.reduce((s, r) => s + r.burned_kcal, 0))} unit="kcal" color="var(--burn)" />
              <Stat label={t("Kayıt girilen gün")} value={`${model.adh.loggedDays}/${model.adh.totalDays}`} />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-semibold">{period === "day" ? t("Öğünlere göre kalori") : period === "year" ? t("Kalori tüketimi (aylık ortalama)") : t("Kalori tüketimi")}</h2>
              <BarSeries data={period === "day" ? model.mealSeries : model.kcalSeries} unit="kcal" target={period === "day" ? null : profile?.kcal_target} />
              {period !== "day" && profile?.kcal_target ? <p className="mt-1 text-xs text-muted">{t("Kesikli çizgi: günlük hedef ({n} kcal)", { n: profile.kcal_target })}</p> : null}
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">{t("Besin değeri dağılımı")}</h2>
              {model.macros.length === 0 ? (
                <Empty title={t("Yiyecek kaydı yok")} />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <Donut data={model.macros} height={144} />
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                    {model.macros.map((m) => (
                      <li key={m.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                          {m.name}
                        </span>
                        <b>%{Math.round(m.value)}</b>
                      </li>
                    ))}
                    <li className="border-t border-border pt-1.5 text-xs text-muted">
                      {t("Günlük ortalama")}: P {nf(model.avgProtein)} g · K {nf(model.avgCarbs)} g · Y {nf(model.avgFat)} g
                    </li>
                    <li className="text-xs text-muted">
                      {t("Şeker")} {nf(model.avgSugar)} g · {t("Lif")} {nf(model.avgFiber)} g · {t("Tuz")} {nf(model.avgSalt, 1)} g
                    </li>
                  </ul>
                </div>
              )}
            </Card>

            {period !== "day" && (
              <Card>
                <h2 className="mb-2 font-semibold">{t("Su tüketimi")}</h2>
                <BarSeries data={model.waterSeries} unit="ml" color="var(--water)" target={profile?.water_target_ml} />
              </Card>
            )}

            <Card>
              <h2 className="mb-2 font-semibold">{t("Kilo değişimi")}</h2>
              {model.weightSeries.length < 2 ? <Empty title={t("Bu dönemde yeterli kilo ölçümü yok")} text={t("Grafik için en az iki ölçüm gerekli")} /> : <LineSeries data={model.weightSeries} unit="kg" target={profile?.target_weight_kg} />}
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">{t("Spor ve aktivite")}</h2>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Stat label={t("Seans")} value={nf(model.act.sessions)} />
                <Stat label={t("Süre")} value={nf(model.act.minutes)} unit={t("dk")} />
                <Stat label={t("Yakılan")} value={nf(model.act.kcal)} unit="kcal" color="var(--burn)" />
              </div>
              {period !== "day" && <BarSeries data={model.burnSeries} unit="kcal" color="var(--burn)" height={150} />}
              {model.act.byType.length > 0 && (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {model.act.byType.map((a) => (
                    <li key={a.type} className="flex justify-between py-1.5">
                      <span>{label(ACTIVITY_LABELS, a.type, lang)}</span>
                      <span className="text-muted">
                        {a.sessions}× · {nf(a.minutes)} {t("dk")} · {nf(a.kcal)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">{t("Alkol tüketimi")}</h2>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Stat label={t("Saf alkol")} value={nf(model.alcoholTotal, 1)} unit="g" />
                <Stat label={t("Standart içki")} value={nf(standardDrinks(model.alcoholTotal), 1)} />
                <Stat label={t("Alkollü gün")} value={`${model.alcoholDays}/${model.rows.length}`} />
              </div>
              {model.alcoholTotal > 0 && period !== "day" ? <BarSeries data={model.alcoholSeries} unit="g" color="var(--fat)" height={150} /> : model.alcoholTotal === 0 ? <p className="text-sm text-muted">{t("Bu dönemde alkol kaydı yok.")}</p> : null}
              <p className="mt-2 text-xs text-muted">{t("Tüm içeceklerden alınan kalori: {n} kcal", { n: nf(model.drinkKcal) })}</p>
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">{t("En sık tüketilen yiyecekler")}</h2>
              {model.top.byCount.length === 0 ? (
                <Empty title={t("Yiyecek kaydı yok")} />
              ) : (
                <ol className="divide-y divide-border text-sm">
                  {model.top.byCount.map((f, i) => (
                    <li key={f.name} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {f.name}
                      </span>
                      <span className="shrink-0 text-muted">
                        {f.count}× · {nf(f.kcal)} kcal
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <h2 className="mb-2 font-semibold">{t("En çok kalori alınan yiyecekler")}</h2>
              {model.top.byKcal.length === 0 ? (
                <Empty title={t("Yiyecek kaydı yok")} />
              ) : (
                <ol className="space-y-2 text-sm">
                  {model.top.byKcal.slice(0, 6).map((f) => (
                    <li key={f.name}>
                      <div className="mb-1 flex justify-between gap-3">
                        <span className="min-w-0 truncate">{f.name}</span>
                        <span className="shrink-0 font-medium">{nf(f.kcal)} kcal</span>
                      </div>
                      <Bar value={f.kcal} max={model.top.byKcal[0].kcal} color="var(--carbs)" />
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 font-semibold">{t("Hedeflere uyum")}</h2>
              <p className="mb-3 text-xs text-muted">{t("Kayıt girilen günler içinde hedefi tutturduğunuz günlerin oranı.")}</p>
              <div className="space-y-3">
                {adhRow(t("Kalori (hedefin ±%10'u)"), model.adh.calories)}
                {adhRow(t("Protein"), model.adh.protein)}
                {adhRow(t("Su"), model.adh.water)}
                {adhRow(t("Adım"), model.adh.steps)}
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 font-semibold">{t("Kişisel ilişkiler")}</h2>
              <p className="mb-3 text-xs text-muted">{t("Beslenme, uyku, ruh hali, aktivite ve kilo kayıtlarınız arasındaki eğilimler. İlişki, nedensellik anlamına gelmez.")}</p>
              {relTexts.length === 0 ? (
                <p className="text-sm text-muted">{t("Henüz yeterli veri yok. En az 5 gün boyunca uyku, ruh hali ve öğün kaydı girdiğinizde eğilimler burada görünür.")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {relTexts.map((x) => (
                    <li key={x} className="rounded-xl bg-surface-2 px-3 py-2">
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="no-print">
            <h2 className="mb-1 font-semibold">{t("Dışa aktar")}</h2>
            <p className="mb-3 text-xs text-muted">{t("Seçili dönemin raporunu indirin.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={exporting === "pdf"} onClick={() => exportFile("pdf")}>
                <Download size={16} />
                PDF
              </Button>
              <Button variant="secondary" loading={exporting === "csv"} onClick={() => exportFile("csv")}>
                <Download size={16} />
                {t("CSV (günlük özet)")}
              </Button>
              <Button variant="secondary" loading={exporting === "entries"} onClick={() => exportFile("entries")}>
                <Download size={16} />
                {t("CSV (tüm kayıtlar)")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
