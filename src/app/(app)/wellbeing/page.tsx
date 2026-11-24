"use client";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Button, Card, Field, NumberInput, PageHeader, Textarea, cx } from "@/components/ui";
import { useDay } from "@/lib/data/hooks";
import { saveDaily } from "@/lib/data/actions";
import type { DailyLog } from "@/lib/types";

function Scale({ value, onChange, labels }: { value: number | null; onChange: (v: number | null) => void; labels: string[] }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {labels.map((l, i) => {
        const v = i + 1;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={l}
            title={l}
            onClick={() => onChange(value === v ? null : v)}
            className={cx("flex h-11 flex-1 flex-col items-center justify-center rounded-xl border text-sm font-semibold", value === v ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted")}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

/** Yatış ve kalkış saatinden süreyi (gece yarısını aşarak) 0,5 saat adımıyla hesaplar. */
function sleepHours(bed: string, wake: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(bed) || !/^\d{2}:\d{2}$/.test(wake)) return null;
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  let d = m(wake) - m(bed);
  if (d <= 0) d += 24 * 60;
  return Math.round(d / 30) / 2;
}

function WellbeingInner() {
  const { t, toast } = useApp();
  const [date, setDate] = useDateParam();
  const day = useDay(date);
  const existing = day.data?.daily[0];
  const [sleep, setSleep] = useState<{ sleep_hours: number | null; sleep_quality: number | null }>({ sleep_hours: null, sleep_quality: null });
  const [bed, setBed] = useState("");
  const [wake, setWake] = useState("");
  const [dayForm, setDayForm] = useState<Pick<DailyLog, "mood" | "energy" | "stress" | "note">>({ mood: null, energy: null, stress: null, note: null });
  const [sleepDirty, setSleepDirty] = useState(false);
  const [dayDirty, setDayDirty] = useState(false);
  const [busy, setBusy] = useState<"sleep" | "day" | null>(null);

  // Gün değiştiğinde ya da kayıt yüklendiğinde formları doldur (kullanıcı düzenlemeye başlamadıysa).
  useEffect(() => {
    if (sleepDirty) return;
    setSleep({ sleep_hours: existing?.sleep_hours ?? null, sleep_quality: existing?.sleep_quality ?? null });
    setBed(existing?.sleep_bedtime ?? "");
    setWake(existing?.sleep_waketime ?? "");
  }, [existing, sleepDirty]);
  useEffect(() => {
    if (dayDirty) return;
    setDayForm({ mood: existing?.mood ?? null, energy: existing?.energy ?? null, stress: existing?.stress ?? null, note: existing?.note ?? null });
  }, [existing, dayDirty]);

  const setS = (patch: Partial<typeof sleep>) => {
    setSleepDirty(true);
    setSleep((f) => ({ ...f, ...patch }));
  };
  const setD = (patch: Partial<typeof dayForm>) => {
    setDayDirty(true);
    setDayForm((f) => ({ ...f, ...patch }));
  };
  const setTimes = (b: string, w: string) => {
    setBed(b);
    setWake(w);
    const h = sleepHours(b, w);
    setSleepDirty(true);
    setSleep((f) => ({ ...f, sleep_hours: h ?? f.sleep_hours }));
  };

  async function persist(kind: "sleep" | "day") {
    if (kind === "sleep" && sleep.sleep_hours != null && (sleep.sleep_hours < 0 || sleep.sleep_hours > 24)) return toast(t("Uyku süresi 0–24 saat arasında olmalı."), "error");
    setBusy(kind);
    try {
      const patch = kind === "sleep" ? { ...sleep, sleep_bedtime: bed || null, sleep_waketime: wake || null } : { ...dayForm, note: dayForm.note?.trim() || null };
      const { queued } = await saveDaily(date, existing, patch);
      if (kind === "sleep") setSleepDirty(false);
      else setDayDirty(false);
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Kaydedildi."), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(null);
    }
  }

  const low = [t("Çok kötü"), t("Kötü"), t("Orta"), t("İyi"), t("Çok iyi")];
  const level = [t("Çok düşük"), t("Düşük"), t("Orta"), t("Yüksek"), t("Çok yüksek")];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title={t("Uyku ve günlük durum")} subtitle={t("Tüm alanlar isteğe bağlıdır.")} />
      <DateNav
        date={date}
        onChange={(d) => {
          setSleepDirty(false);
          setDayDirty(false);
          setBed("");
          setWake("");
          setDate(d);
        }}
      />
      <Card className="space-y-4">
        <div>
          <p className="font-semibold">{t("Dün gece nasıl uyudun?")}</p>
          <p className="text-xs text-muted">{t("Sabah, uyandıktan sonra doldurun.")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Yatış saati")}>
            <input type="time" value={bed} onChange={(e) => setTimes(e.target.value, wake)} className="h-12 w-full rounded-xl border border-border bg-surface px-3" />
          </Field>
          <Field label={t("Kalkış saati")}>
            <input type="time" value={wake} onChange={(e) => setTimes(bed, e.target.value)} className="h-12 w-full rounded-xl border border-border bg-surface px-3" />
          </Field>
        </div>
        <Field label={t("Uyku süresi (saat)")} hint={t("Saatleri girerseniz süre otomatik hesaplanır; elle de yazabilirsiniz.")}>
          <NumberInput value={sleep.sleep_hours} onChange={(v) => setS({ sleep_hours: v })} min={0} max={24} step="0.5" placeholder="7.5" />
        </Field>
        <Field label={t("Uyku kalitesi")} hint={`1 = ${low[0]} · 5 = ${low[4]}`}>
          <Scale value={sleep.sleep_quality} onChange={(v) => setS({ sleep_quality: v })} labels={low} />
        </Field>
        <Button size="lg" className="w-full" loading={busy === "sleep"} disabled={!sleepDirty} onClick={() => persist("sleep")}>
          {t("Uykuyu kaydet")}
        </Button>
      </Card>
      <Card className="space-y-4">
        <div>
          <p className="font-semibold">{t("Bugün nasıl geçti?")}</p>
          <p className="text-xs text-muted">{t("Gün içinde ya da akşam doldurun.")}</p>
        </div>
        <Field label={t("Ruh hali")} hint={`1 = ${low[0]} · 5 = ${low[4]}`}>
          <Scale value={dayForm.mood} onChange={(v) => setD({ mood: v })} labels={low} />
        </Field>
        <Field label={t("Enerji seviyesi")} hint={`1 = ${level[0]} · 5 = ${level[4]}`}>
          <Scale value={dayForm.energy} onChange={(v) => setD({ energy: v })} labels={level} />
        </Field>
        <Field label={t("Stres seviyesi")} hint={`1 = ${level[0]} · 5 = ${level[4]}`}>
          <Scale value={dayForm.stress} onChange={(v) => setD({ stress: v })} labels={level} />
        </Field>
        <Field label={t("Günlük not")}>
          <Textarea value={dayForm.note ?? ""} onChange={(e) => setD({ note: e.target.value })} maxLength={2000} placeholder={t("Bugün nasıl geçti?")} />
        </Field>
        <Button size="lg" className="w-full" loading={busy === "day"} disabled={!dayDirty} onClick={() => persist("day")}>
          {t("Günü kaydet")}
        </Button>
      </Card>
      <p className="text-xs text-muted">{t("Uyku, ruh hali, beslenme ve aktivite arasındaki ilişkileri İstatistikler › Kişisel ilişkiler bölümünde görebilirsiniz. Notlarınız yapay zekâya gönderilmez.")}</p>
    </div>
  );
}

export default function WellbeingPage() {
  return (
    <Suspense>
      <WellbeingInner />
    </Suspense>
  );
}
