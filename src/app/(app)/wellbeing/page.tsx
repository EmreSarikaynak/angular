"use client";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Button, Card, Field, NumberInput, PageHeader, Textarea, cx } from "@/components/ui";
import { useDay } from "@/lib/data/hooks";
import { saveDaily } from "@/lib/data/actions";
import type { DailyLog } from "@/lib/types";

type ScaleKey = "sleep_quality" | "mood" | "energy" | "stress";

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

function WellbeingInner() {
  const { t, toast } = useApp();
  const [date, setDate] = useDateParam();
  const day = useDay(date);
  const existing = day.data?.daily[0];
  const [form, setForm] = useState<Pick<DailyLog, "sleep_hours" | ScaleKey | "note">>({ sleep_hours: null, sleep_quality: null, mood: null, energy: null, stress: null, note: null });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Gün değiştiğinde ya da kayıt yüklendiğinde formu doldur (kullanıcı düzenlemeye başlamadıysa).
  useEffect(() => {
    if (dirty) return;
    setForm({
      sleep_hours: existing?.sleep_hours ?? null,
      sleep_quality: existing?.sleep_quality ?? null,
      mood: existing?.mood ?? null,
      energy: existing?.energy ?? null,
      stress: existing?.stress ?? null,
      note: existing?.note ?? null,
    });
  }, [existing, dirty]);

  const set = (patch: Partial<typeof form>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  async function save() {
    if (form.sleep_hours != null && (form.sleep_hours < 0 || form.sleep_hours > 24)) return toast(t("Uyku süresi 0–24 saat arasında olmalı."), "error");
    setBusy(true);
    try {
      const { queued } = await saveDaily(date, existing, { ...form, note: form.note?.trim() || null });
      setDirty(false);
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Kaydedildi."), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  const low = [t("Çok kötü"), t("Kötü"), t("Orta"), t("İyi"), t("Çok iyi")];
  const level = [t("Çok düşük"), t("Düşük"), t("Orta"), t("Yüksek"), t("Çok yüksek")];

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("Uyku ve günlük durum")} subtitle={t("Tüm alanlar isteğe bağlıdır.")} />
      <DateNav
        date={date}
        onChange={(d) => {
          setDirty(false);
          setDate(d);
        }}
      />
      <Card className="space-y-4">
        <Field label={t("Uyku süresi (saat)")}>
          <NumberInput value={form.sleep_hours} onChange={(v) => set({ sleep_hours: v })} min={0} max={24} step="0.5" placeholder="7.5" />
        </Field>
        <Field label={t("Uyku kalitesi")} hint={`1 = ${low[0]} · 5 = ${low[4]}`}>
          <Scale value={form.sleep_quality} onChange={(v) => set({ sleep_quality: v })} labels={low} />
        </Field>
        <Field label={t("Ruh hali")} hint={`1 = ${low[0]} · 5 = ${low[4]}`}>
          <Scale value={form.mood} onChange={(v) => set({ mood: v })} labels={low} />
        </Field>
        <Field label={t("Enerji seviyesi")} hint={`1 = ${level[0]} · 5 = ${level[4]}`}>
          <Scale value={form.energy} onChange={(v) => set({ energy: v })} labels={level} />
        </Field>
        <Field label={t("Stres seviyesi")} hint={`1 = ${level[0]} · 5 = ${level[4]}`}>
          <Scale value={form.stress} onChange={(v) => set({ stress: v })} labels={level} />
        </Field>
        <Field label={t("Günlük not")}>
          <Textarea value={form.note ?? ""} onChange={(e) => set({ note: e.target.value })} maxLength={2000} placeholder={t("Bugün nasıl geçti?")} />
        </Field>
        <Button size="lg" className="w-full" loading={busy} disabled={!dirty} onClick={save}>
          {t("Kaydet")}
        </Button>
      </Card>
      <p className="mt-3 text-xs text-muted">{t("Uyku, ruh hali, beslenme ve aktivite arasındaki ilişkileri İstatistikler › Kişisel ilişkiler bölümünde görebilirsiniz. Notlarınız yapay zekâya gönderilmez.")}</p>
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
