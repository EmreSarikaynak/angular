"use client";
import { useState } from "react";
import { CalendarHeart, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, Field, Input, PageHeader, Ring, Skeleton, Stat } from "@/components/ui";
import Link from "next/link";
import { cycleAvailable, cycleInfo, type CyclePhase } from "@/lib/bkn/cycle";
import { useCycleLogs } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { addDays, daysBetween, formatDate, formatShort, toDateKey } from "@/lib/dates";
import type { CycleLog } from "@/lib/types";

export default function CyclePage() {
  const { t, lang, toast, profile } = useApp();
  const logs = useCycleLogs();
  const today = toDateKey();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const list = [...(logs.data ?? [])].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const info = cycleInfo(logs.data ?? [], today);
  const open = list.find((l) => !l.end_date && daysBetween(l.entry_date, today) <= 14);

  const phases: Record<CyclePhase, [string, string]> = {
    menstrual: [t("Adet dönemi"), t("Enerjiniz düşük olabilir; demir açısından zengin besinler ve bol su iyi gelir.")],
    follicular: [t("Foliküler evre"), t("Enerji çoğunlukla yükselir; yoğun antrenmanlar için uygun bir dönemdir.")],
    ovulation: [t("Yumurtlama dönemi"), t("Enerji ve iştah dengeli seyredebilir.")],
    luteal: [t("Luteal evre"), t("İştah artışı ve su tutulumu sık görülür; tartıdaki küçük artışlar çoğunlukla geçicidir.")],
  };

  async function save() {
    if (!start || start > today) return toast(t("Başlangıç tarihi bugünden ileri olamaz."), "error");
    if (end && (end < start || daysBetween(start, end) > 14)) return toast(t("Bitiş tarihi başlangıçtan sonra ve en fazla 14 gün içinde olmalı."), "error");
    setBusy(true);
    try {
      const existing = list.find((l) => l.entry_date === start);
      await upsertRow("cycle_logs", { id: existing?.id ?? uuid(), entry_date: start, end_date: end || null, note: null });
      toast(t("Kaydedildi."));
      setEnd("");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function finish(l: CycleLog) {
    await upsertRow("cycle_logs", { id: l.id, entry_date: l.entry_date, end_date: today, note: l.note }).catch(() => toast(t("Kaydedilemedi."), "error"));
  }

  // Döngü takibi yalnızca kadın profillerinde sunulur; doğrudan adresle gelenlere açıklama gösterilir.
  if (profile && !cycleAvailable(profile.sex)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title={t("Döngü takibi")} />
        <Empty
          icon={<CalendarHeart size={28} />}
          title={t("Bu bölüm profilinizde kullanılmıyor")}
          action={
            <Link href="/" className="font-semibold text-primary">
              {t("Ana sayfaya dön")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Döngü takibi")} subtitle={t("Kilo ve iştah dalgalanmalarını anlamlandırın")} />

      {logs.loading && !logs.data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          {info ? (
            <Card className="mb-4">
              <div className="flex items-center gap-5">
                <Ring value={Math.min(info.day, info.averageLength)} max={info.averageLength} size={120} stroke={11} color="var(--protein)" overColor="var(--protein)" label={t("Döngünün {n}. günü", { n: info.day })}>
                  <span className="text-2xl font-bold">{info.day}</span>
                  <span className="text-[11px] text-muted">{t(". gün")}</span>
                </Ring>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{phases[info.phase][0]}</p>
                  <p className="mt-0.5 text-sm text-muted">{phases[info.phase][1]}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label={t("Sonraki tahmini")} value={formatShort(info.nextStart, lang)} />
                <Stat label={t("Kalan")} value={String(info.daysUntilNext)} unit={t("gün")} />
                <Stat label={t("Ortalama döngü")} value={String(info.averageLength)} unit={t("gün")} />
              </div>
              <p className="mt-3 text-xs text-muted">{info.basedOn > 0 ? t("Tahmin, son {n} döngünüzün ortalamasına dayanır.", { n: info.basedOn }) : t("Yeterli geçmiş olmadığı için 28 günlük varsayılan döngü kullanılıyor; kayıt ekledikçe size göre ayarlanır.")}</p>
              {open && (
                <Button variant="secondary" className="mt-3 w-full" onClick={() => finish(open)}>
                  {t("Adet bugün bitti")}
                </Button>
              )}
            </Card>
          ) : (
            <Card className="mb-4">
              <Empty icon={<CalendarHeart size={22} />} title={t("Henüz kayıt yok")} text={t("Son adet başlangıç tarihinizi ekleyin; döngü günü ve sonraki tahmini tarih hesaplanır.")} />
            </Card>
          )}

          <Card className="space-y-3">
            <p className="text-sm font-semibold">{t("Adet dönemi ekle")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Başlangıç")}>
                <Input type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label={t("Bitiş (isteğe bağlı)")}>
                <Input type="date" value={end} min={start} max={addDays(start, 14) > today ? today : addDays(start, 14)} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <Button size="lg" className="w-full" loading={busy} onClick={save}>
              {t("Kaydet")}
            </Button>
          </Card>

          {list.length > 0 && (
            <Card className="mt-4 p-0">
              <p className="px-4 py-3 text-sm font-semibold">{t("Geçmiş")}</p>
              <ul className="divide-y divide-border border-t border-border">
                {list.map((l, i) => {
                  const prev = list[i + 1];
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{formatDate(l.entry_date, lang, { day: "numeric", month: "long", year: "numeric" })}</p>
                        <p className="text-xs text-muted">
                          {l.end_date ? t("{n} gün sürdü", { n: daysBetween(l.entry_date, l.end_date) + 1 }) : t("bitiş girilmedi")}
                          {prev ? ` · ${t("döngü {n} gün", { n: daysBetween(prev.entry_date, l.entry_date) })}` : ""}
                        </p>
                      </div>
                      <button type="button" aria-label={t("Sil")} onClick={() => confirm(t("Bu kayıt silinsin mi?")) && deleteRow("cycle_logs", l.id).catch(() => toast(t("Silinemedi."), "error"))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
      <p className="mt-4 text-xs text-muted">{t("Döngü kayıtlarınız yalnızca size aittir; yapay zekâya, diyetisyen paylaşımına ve meydan okumalara gönderilmez. Tahminler bilgilendirme amaçlıdır; doğum kontrolü ya da tıbbi karar için kullanılmamalıdır.")}</p>
    </div>
  );
}
